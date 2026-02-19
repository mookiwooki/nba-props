What this is
A React app that shows NBA player prop lines + best available price across sportsbooks.
Stack

React + Vite (no backend, all client-side)
The Odds API for live odds data
API Key: 3c131ee836e805f728c9734da74f187d

API Notes

Base URL: https://api.the-odds-api.com/v4
Get games: GET /sports/basketball_nba/events
Get props: GET /sports/basketball_nba/events/{eventId}/odds
Params: regions=us, oddsFormat=american
Player props must be fetched one event at a time
Free tier: 500 requests/month — be mindful

Prop markets we support

player_points, player_rebounds, player_assists
player_threes, player_blocks, player_steals

Feature roadmap

 Feature 1: Prop line + best available price across books
 Feature 2: TBD
 Feature 3: TBD

Key files

src/App.jsx — main app, all logic lives here for now

Design decisions

Dark theme, monospace font (IBM Plex Mono)
No backend — API called directly from browser
Click a row to expand and see all books side by side

## Current Task
Implement Feature 1 in src/App.jsx:
- Fetch today's NBA games from The Odds API
- Let user pick a game and a prop market (points, rebounds, assists, threes, blocks, steals)
- For each player, show the line + best Over price + best Under price across all US sportsbooks
- Click a row to expand and see all books
- Dark theme, monospace font (IBM Plex Mono)
- No backend, call API directly from browser
- API key: 3c131ee836e805f728c9734da74f187d