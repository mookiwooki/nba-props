import React, { useState, useEffect } from 'react'
import './App.css'

const API_KEY = '3c131ee836e805f728c9734da74f187d'
const BASE_URL = 'https://api.the-odds-api.com/v4'

const MARKETS = [
  { key: 'player_points', label: 'Points' },
  { key: 'player_rebounds', label: 'Rebounds' },
  { key: 'player_assists', label: 'Assists' },
  { key: 'player_threes', label: '3-Pointers' },
  { key: 'player_blocks', label: 'Blocks' },
  { key: 'player_steals', label: 'Steals' },
]

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

  const togglePlayer = name =>
    setExpandedPlayer(prev => (prev === name ? null : name))

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

          <div className="hint">click a row to see all books</div>

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
                {players.map(player => (
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
                ))}
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
