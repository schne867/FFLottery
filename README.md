# FF Lottery - Fantasy Football Draft Lottery Selection

A web application for running a weighted lottery selection for fantasy football draft order using the Sleeper API.

## Features

- 🔗 **Sleeper API Integration**: Automatically fetches team names, records, and avatars from your Sleeper league
- 🎲 **Weighted Lottery**: Set custom odds for each team to determine draft order
- ⏱️ **Countdown Animation**: Watch the lottery unfold with a countdown from last place to winner
- 🎨 **Material UI**: Clean, modern interface built with Material UI

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Finding Your Sleeper League ID

1. Go to your Sleeper league on the web or app
2. The league ID is in the URL: `https://sleeper.app/leagues/LEAGUE_ID`
3. Copy the `LEAGUE_ID` and paste it into the app

## How to Use

1. **Enter League ID**: Paste your Sleeper league ID into the input field
2. **Load Teams**: Click "Load Teams" to fetch all teams from your league
3. **Set Odds**: Adjust the lottery odds for each team (higher number = better chance)
   - By default, odds are set based on reverse standings (worst team gets highest odds)
4. **Run Lottery**: Click "Run Lottery" to start the selection process
5. **View Results**: See the complete draft order from winner to last place

## Lottery Logic

The lottery uses the NBA-style Plackett-Luce model for weighted random selection:
- Each team's chance is proportional to their combination value (odds)
- **Selections are made from first pick (winner) to last place** - Pick #1 is selected first, then Pick #2, then Pick #3, and so on
- Uses sampling without replacement: once a team is selected, they are removed from the pool for subsequent picks
- Probabilities are recalculated after each selection based on remaining teams' combinations
- The animation displays picks in reverse order (worst pick first, winner last) for dramatic effect, but the actual selection process determines Pick #1 first

## Technologies Used

- React 18
- Material UI (MUI)
- Vite
- Sleeper API

## License

MIT

