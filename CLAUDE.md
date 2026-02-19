What this is
A React app that shows NBA player prop lines + best available price across sportsbooks.
Stack

React + Vite (no backend, all client-side)
The Odds API for live odds data
API Key: 3c131ee836e805f728c9734da74f187d
Ball Dont Lie for player stats
API Key: ffa62304-5ba5-4e55-8053-03bd8ee9d921

### API Notes

## The Odds
Base URL: https://api.the-odds-api.com/v4
Get games: GET /sports/basketball_nba/events
Get props: GET /sports/basketball_nba/events/{eventId}/odds
Params: regions=us, oddsFormat=american
Player props must be fetched one event at a time
Free tier: 500 requests/month — be mindful

## Ball Dont Lie
AI URL: https://www.balldontlie.io/openapi.yml
Base URL: https://api.balldontlie.io

Prop markets we support

player_points, player_rebounds, player_assists
player_threes, player_blocks, player_steals

Feature roadmap

 Feature 1: Prop line + best available price across books
 Feature 2: Hit rate vs this line
 Feature 3: TBD

Key files

src/App.jsx — main app, all logic lives here for now

Design decisions

Dark theme, monospace font (IBM Plex Mono)
No backend — API called directly from browser
Click a row to expand and see all books side by side

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
- Show hit rate vs the prop line for: season, L10, L5, L3
- Color coded green/amber/red (≥65% / 50-64% / <50%)
- Weighted score: season×10% + L10×20% + L5×30% + L3×40%
- Results cached per player+market+line so each player only costs 2 API calls once