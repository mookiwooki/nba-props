What this is
A React app that shows NBA player prop lines + best available price across sportsbooks.

## Stack

- React + Vite (no backend, all client-side)
- The Odds API for live odds data — API Key: 3c131ee836e805f728c9734da74f187d
- Ball Don't Lie for player stats — API Key: ffa62304-5ba5-4e55-8053-03bd8ee9d921 (GOAT tier)

## API Notes

### The Odds API
- Base URL: https://api.the-odds-api.com/v4
- Get games: GET /sports/basketball_nba/events
- Get props: GET /sports/basketball_nba/events/{eventId}/odds
- Params: regions=us, oddsFormat=american
- Player props must be fetched one event at a time
- Free tier: 500 requests/month — be mindful
- Quota (used/remaining) shown in the header

### Ball Don't Lie
- OpenAPI spec: https://www.balldontlie.io/openapi.yml
- Base URL: https://api.balldontlie.io
- GOAT tier ($39.99/mo) — grants access to player game logs via /nba/v1/stats
- Rate limit: 600 req/min — a countdown timer in the header tracks time since last call
- Player search falls back to last-name search + normalized name matching to handle
  name mismatches between The Odds API and BDL (Jr. suffixes, initials, accented chars)
- If stats endpoint returns 401, falls back to season averages (/nba/v1/season_averages)

## Prop markets we support

player_points, player_rebounds, player_assists, player_threes, player_blocks, player_steals

## Feature roadmap

- [x] Feature 1: Prop line + best available price across books
- [x] Feature 2: Hit rate vs this line
- [ ] Feature 3: TBD

## Key files

- src/App.jsx — main app, all logic lives here for now
- src/App.css — styles

## Design decisions

- Dark theme, monospace font (IBM Plex Mono)
- No backend — API called directly from browser
- Click a row to expand and see all books side by side
- BDL results cached per player+market+line so each player only costs 2 API calls once

## Completed Tasks

### Feature 1
- Fetch today's NBA games from The Odds API
- Let user pick a game and a prop market (points, rebounds, assists, threes, blocks, steals)
- For each player, show the line + best Over price + best Under price across all US sportsbooks
- Click a row to expand and see all books
- Dark theme, monospace font (IBM Plex Mono)
- No backend, call API directly from browser

### Feature 2
- On row expand, fetch player's 2024-25 game logs from Ball Don't Lie
- Show hit rate vs the prop line for: Season, L10, L5, L3
- Color coded green/amber/red (≥65% / 50-64% / <50%)
- Weighted score: season×10% + L10×20% + L5×30% + L3×40%
- Results cached per player+market+line so each player only costs 2 API calls once
- Robust player name matching: full name search first, falls back to last name + normalization
- Retry-After header surfaced in rate limit error messages
- BDL rate limit countdown timer shown in header (amber while within 60s window)
- Graceful fallback to season averages if stats endpoint is unavailable (401)
