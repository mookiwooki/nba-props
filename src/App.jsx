import React, { useState, useEffect } from 'react'
import './App.css'

const API_KEY = '3c131ee836e805f728c9734da74f187d'
const BASE_URL = 'https://api.the-odds-api.com/v4'

const BDLIE_KEY = 'ffa62304-5ba5-4e55-8053-03bd8ee9d921'
const BDLIE_BASE = 'https://api.balldontlie.io'

const MARKETS = [
  { key: 'player_points', label: 'Points' },
  { key: 'player_rebounds', label: 'Rebounds' },
  { key: 'player_assists', label: 'Assists' },
  { key: 'player_threes', label: '3-Pointers' },
  { key: 'player_blocks', label: 'Blocks' },
  { key: 'player_steals', label: 'Steals' },
]

const MARKET_TO_STAT = {
  player_points: 'pts',
  player_rebounds: 'reb',
  player_assists: 'ast',
  player_threes: 'fg3m',
  player_blocks: 'blk',
  player_steals: 'stl',
}

function formatOdds(price) {
  if (price === null || price === undefined) return '—'
  return price > 0 ? `+${price}` : `${price}`
}

function formatGame(game) {
  const date = new Date(game.commence_time)
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return `${game.away_team} @ ${game.home_team}  ${time}`
}

function processPropsData(data, marketKey) {
  const playerMap = {}

  for (const bookmaker of data.bookmakers) {
    const mkt = bookmaker.markets.find(m => m.key === marketKey)
    if (!mkt) continue

    for (const outcome of mkt.outcomes) {
      const name = outcome.description
      const side = outcome.name // 'Over' or 'Under'
      const price = outcome.price
      const line = outcome.point

      if (!playerMap[name]) {
        playerMap[name] = { line, books: {} }
      }
      if (!playerMap[name].books[bookmaker.title]) {
        playerMap[name].books[bookmaker.title] = { over: null, under: null, line: null }
      }

      playerMap[name].books[bookmaker.title].line = line
      if (side === 'Over') {
        playerMap[name].books[bookmaker.title].over = price
      } else {
        playerMap[name].books[bookmaker.title].under = price
      }
    }
  }

  const players = []
  for (const [name, info] of Object.entries(playerMap)) {
    let bestOver = null
    let bestOverBook = null
    let bestUnder = null
    let bestUnderBook = null

    for (const [bookName, odds] of Object.entries(info.books)) {
      if (odds.over !== null && (bestOver === null || odds.over > bestOver)) {
        bestOver = odds.over
        bestOverBook = bookName
      }
      if (odds.under !== null && (bestUnder === null || odds.under > bestUnder)) {
        bestUnder = odds.under
        bestUnderBook = bookName
      }
    }

    players.push({
      name,
      line: info.line,
      bestOver,
      bestOverBook,
      bestUnder,
      bestUnderBook,
      books: info.books,
    })
  }

  players.sort((a, b) => a.name.localeCompare(b.name))
  return players
}

function oddsClass(price) {
  if (price === null || price === undefined) return ''
  return price > 0 ? 'positive' : 'negative'
}

// ── Hit rate helpers ──────────────────────────────────────

function rateLimitMsg(res) {
  const retryAfter = res.headers.get('Retry-After')
  if (retryAfter) {
    const secs = parseInt(retryAfter, 10)
    if (!isNaN(secs)) return `rate limited — retry in ${secs}s`
    return `rate limited — retry after ${retryAfter}`
  }
  return 'rate limited — wait a moment'
}

async function fetchHitRate(playerName, line, marketKey) {
  const statKey = MARKET_TO_STAT[marketKey]
  const headers = { Authorization: BDLIE_KEY }

  const normalize = s => s.toLowerCase().replace(/[^a-z]/g, '')

  const searchRes = await fetch(
    `${BDLIE_BASE}/nba/v1/players?search=${encodeURIComponent(playerName)}&per_page=10`,
    { headers },
  )
  if (searchRes.status === 429) throw new Error(rateLimitMsg(searchRes))
  if (!searchRes.ok) throw new Error(`search ${searchRes.status}`)
  const { data: firstPass } = await searchRes.json()

  let player = firstPass?.[0] ?? null

  // Fallback: search by last name and match normalized full name
  // (handles suffixes like Jr., initials like P.J., accented chars, etc.)
  if (!player) {
    const lastName = playerName.split(' ').slice(-1)[0]
    const fallbackRes = await fetch(
      `${BDLIE_BASE}/nba/v1/players?search=${encodeURIComponent(lastName)}&per_page=25`,
      { headers },
    )
    if (fallbackRes.status === 429) throw new Error(rateLimitMsg(fallbackRes))
    if (!fallbackRes.ok) throw new Error(`search ${fallbackRes.status}`)
    const { data: candidates } = await fallbackRes.json()
    const target = normalize(playerName)
    player = candidates?.find(p => normalize(`${p.first_name} ${p.last_name}`) === target) ?? null
  }

  if (!player) throw new Error('player not found')

  const statsRes = await fetch(
    `${BDLIE_BASE}/nba/v1/stats?player_ids[]=${player.id}&seasons[]=2024&per_page=100&postseason=false`,
    { headers },
  )
  if (statsRes.status === 429) throw new Error(rateLimitMsg(statsRes))

  if (statsRes.ok) {
    const { data: raw } = await statsRes.json()

    // Sort most recent first; min > 0 filters DNPs
    const values = raw
      .filter(g => g.min > 0)
      .sort((a, b) => new Date(b.game.date) - new Date(a.game.date))
      .map(g => g[statKey] ?? 0)

    if (!values.length) throw new Error('no game data')

    const calc = arr => {
      if (!arr.length) return null
      const hits = arr.filter(v => v > line).length
      return { hits, total: arr.length, rate: hits / arr.length }
    }

    const season = calc(values)
    const l10    = calc(values.slice(0, 10))
    const l5     = calc(values.slice(0, 5))
    const l3     = calc(values.slice(0, 3))

    const weighted =
      (season.rate) * 0.10 +
      (l10.rate)    * 0.20 +
      (l5.rate)     * 0.30 +
      (l3.rate)     * 0.40

    return { type: 'hitrate', season, l10, l5, l3, weighted }
  }

  // Stats endpoint requires paid plan — fall back to season averages
  if (statsRes.status !== 401) throw new Error(`stats ${statsRes.status}`)

  const avgRes = await fetch(
    `${BDLIE_BASE}/nba/v1/season_averages?season=2024&player_ids[]=${player.id}`,
    { headers },
  )
  if (avgRes.status === 429) throw new Error(rateLimitMsg(avgRes))
  if (!avgRes.ok) throw new Error(`averages ${avgRes.status}`)
  const { data: avgs } = await avgRes.json()
  if (!avgs?.length) throw new Error('no season data')

  return { type: 'average', avg: avgs[0][statKey] ?? 0 }
}

function rateClass(rate) {
  if (rate >= 0.65) return 'hr-hot'
  if (rate >= 0.50) return 'hr-mid'
  return 'hr-cold'
}

function HitRatePanel({ data, line, marketLabel }) {
  if (!data || data.loading) {
    return (
      <div className="hitrate-panel hitrate-loading">
        <span className="spinner" />
        <span>loading hit rate…</span>
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="hitrate-panel hitrate-err">
        hit rate: {data.error}
      </div>
    )
  }

  if (data.type === 'average') {
    const { avg } = data
    const delta = avg - line
    const ratio = avg / line
    const cls = ratio >= 1.1 ? 'hr-hot' : ratio >= 0.9 ? 'hr-mid' : 'hr-cold'
    return (
      <div className="hitrate-panel">
        <div className="hitrate-hd">
          SEASON AVG <span className="hitrate-line">vs {line} {marketLabel.toLowerCase()}</span>
        </div>
        <div className="hitrate-cells">
          <div className="hitrate-cell">
            <div className="hr-lbl">AVG</div>
            <div className={`hr-val ${cls}`}>{avg.toFixed(1)}</div>
            <div className="hr-sub">{delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs line</div>
          </div>
        </div>
      </div>
    )
  }

  const { season, l10, l5, l3, weighted } = data

  return (
    <div className="hitrate-panel">
      <div className="hitrate-hd">
        HIT RATE <span className="hitrate-line">vs {line} {marketLabel.toLowerCase()}</span>
      </div>
      <div className="hitrate-cells">
        {[
          { label: 'SEASON', r: season },
          { label: 'L10',    r: l10 },
          { label: 'L5',     r: l5 },
          { label: 'L3',     r: l3 },
        ].map(({ label, r }) => (
          <div key={label} className="hitrate-cell">
            <div className="hr-lbl">{label}</div>
            <div className={`hr-val ${rateClass(r.rate)}`}>
              {Math.round(r.rate * 100)}%
            </div>
            <div className="hr-sub">{r.hits}/{r.total}</div>
          </div>
        ))}
        <div className="hitrate-cell hitrate-score">
          <div className="hr-lbl">SCORE</div>
          <div className={`hr-val ${rateClass(weighted)}`}>
            {Math.round(weighted * 100)}%
          </div>
          <div className="hr-sub">wtd</div>
        </div>
      </div>
    </div>
  )
}

// ── Main app ──────────────────────────────────────────────

export default function App() {
  const [games, setGames] = useState([])
  const [selectedGameId, setSelectedGameId] = useState('')
  const [selectedMarket, setSelectedMarket] = useState('player_points')
  const [players, setPlayers] = useState([])
  const [expandedPlayer, setExpandedPlayer] = useState(null)
  const [loadingGames, setLoadingGames] = useState(false)
  const [loadingProps, setLoadingProps] = useState(false)
  const [error, setError] = useState(null)
  const [quota, setQuota] = useState({ used: null, remaining: null })
  const [hitRates, setHitRates] = useState({})

  // Fetch today's games on mount
  useEffect(() => {
    setLoadingGames(true)
    setError(null)
    fetch(`${BASE_URL}/sports/basketball_nba/events?apiKey=${API_KEY}&oddsFormat=american`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const used = r.headers.get('x-requests-used')
        const remaining = r.headers.get('x-requests-remaining')
        if (used !== null) setQuota({ used, remaining })
        return r.json()
      })
      .then(data => {
        if (data.message) throw new Error(data.message)
        setGames(data)
        setLoadingGames(false)
      })
      .catch(err => {
        setError(`Failed to load games: ${err.message}`)
        setLoadingGames(false)
      })
  }, [])

  // Fetch props when game or market changes
  useEffect(() => {
    if (!selectedGameId) {
      setPlayers([])
      return
    }
    setLoadingProps(true)
    setError(null)
    setPlayers([])
    setExpandedPlayer(null)

    const url =
      `${BASE_URL}/sports/basketball_nba/events/${selectedGameId}/odds` +
      `?apiKey=${API_KEY}&regions=us&oddsFormat=american&markets=${selectedMarket}`

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const used = r.headers.get('x-requests-used')
        const remaining = r.headers.get('x-requests-remaining')
        if (used !== null) setQuota({ used, remaining })
        return r.json()
      })
      .then(data => {
        if (data.message) throw new Error(data.message)
        setPlayers(processPropsData(data, selectedMarket))
        setLoadingProps(false)
      })
      .catch(err => {
        setError(`Failed to load props: ${err.message}`)
        setLoadingProps(false)
      })
  }, [selectedGameId, selectedMarket])

  async function loadHitRate(name, line, marketKey, cacheKey) {
    setHitRates(prev => ({ ...prev, [cacheKey]: { loading: true } }))
    try {
      const result = await fetchHitRate(name, line, marketKey)
      setHitRates(prev => ({ ...prev, [cacheKey]: { loading: false, ...result } }))
    } catch (err) {
      setHitRates(prev => ({ ...prev, [cacheKey]: { loading: false, error: err.message } }))
    }
  }

  const togglePlayer = name => {
    const next = expandedPlayer === name ? null : name
    setExpandedPlayer(next)
    if (next) {
      const player = players.find(p => p.name === name)
      if (player) {
        const cacheKey = `${name}|${selectedMarket}|${player.line}`
        if (!hitRates[cacheKey]) {
          loadHitRate(name, player.line, selectedMarket, cacheKey)
        }
      }
    }
  }

  const selectedGame = games.find(g => g.id === selectedGameId)

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="header-title">NBA Props</div>
          <div className="header-sub">best price across US sportsbooks</div>
        </div>
        {quota.used !== null && (
          <div className="quota">
            <span className="quota-item">{quota.used} used</span>
            <span className="quota-sep">/</span>
            <span className="quota-item">{quota.remaining} left</span>
          </div>
        )}
      </header>

      <div className="controls">
        <div className="select-group">
          <label className="select-label">GAME</label>
          <select
            className="select"
            value={selectedGameId}
            onChange={e => {
              setSelectedGameId(e.target.value)
              setExpandedPlayer(null)
            }}
            disabled={loadingGames}
          >
            <option value="">
              {loadingGames ? 'Loading games...' : '— pick a game —'}
            </option>
            {games.map(g => (
              <option key={g.id} value={g.id}>
                {formatGame(g)}
              </option>
            ))}
          </select>
        </div>

        <div className="select-group">
          <label className="select-label">MARKET</label>
          <select
            className="select"
            value={selectedMarket}
            onChange={e => setSelectedMarket(e.target.value)}
            disabled={!selectedGameId}
          >
            {MARKETS.map(m => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loadingProps && (
        <div className="loading">
          <span className="spinner" /> fetching props...
        </div>
      )}

      {players.length > 0 && (
        <>
          {selectedGame && (
            <div className="game-header">
              {selectedGame.away_team} @ {selectedGame.home_team}
              <span className="market-badge">
                {MARKETS.find(m => m.key === selectedMarket)?.label}
              </span>
            </div>
          )}

          <div className="hint">click a row to see all books + hit rate</div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Line</th>
                  <th>Best Over</th>
                  <th>Best Under</th>
                </tr>
              </thead>
              <tbody>
                {players.map(player => {
                  const cacheKey = `${player.name}|${selectedMarket}|${player.line}`
                  const mktLabel = MARKETS.find(m => m.key === selectedMarket)?.label ?? ''
                  return (
                    <React.Fragment key={player.name}>
                      <tr
                        className={`player-row${expandedPlayer === player.name ? ' is-expanded' : ''}`}
                        onClick={() => togglePlayer(player.name)}
                      >
                        <td className="td-name">{player.name}</td>
                        <td className="td-line">{player.line}</td>
                        <td className={`td-odds ${oddsClass(player.bestOver)}`}>
                          {formatOdds(player.bestOver)}
                          {player.bestOverBook && (
                            <span className="book-tag">{player.bestOverBook}</span>
                          )}
                        </td>
                        <td className={`td-odds ${oddsClass(player.bestUnder)}`}>
                          {formatOdds(player.bestUnder)}
                          {player.bestUnderBook && (
                            <span className="book-tag">{player.bestUnderBook}</span>
                          )}
                        </td>
                      </tr>

                      {expandedPlayer === player.name && (
                        <tr className="books-row">
                          <td colSpan={4}>
                            <HitRatePanel
                              data={hitRates[cacheKey]}
                              line={player.line}
                              marketLabel={mktLabel}
                            />
                            <div className="books-grid">
                              {Object.entries(player.books).map(([book, odds]) => (
                                <div key={book} className="book-card">
                                  <div className="book-card-name">{book}</div>
                                  <div className="book-card-line">
                                    Line: <strong>{odds.line}</strong>
                                  </div>
                                  <div className="book-card-odds">
                                    <span className={oddsClass(odds.over)}>
                                      O&nbsp;{formatOdds(odds.over)}
                                    </span>
                                    <span className={oddsClass(odds.under)}>
                                      U&nbsp;{formatOdds(odds.under)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loadingProps && selectedGameId && players.length === 0 && !error && (
        <div className="empty">no props available for this market</div>
      )}
    </div>
  )
}
