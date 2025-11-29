# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start development server (http://localhost:5173)
npm run build    # Build for production
npm run preview  # Preview production build
```

## Architecture Overview

This is a React/Vite application for running weighted lottery selections for fantasy football draft order using the Sleeper API.

### Core Application Flow

1. User enters Sleeper league ID → App fetches teams, rosters, and draft history
2. Teams are sorted by record (worst to best) and assigned to lottery slots
3. Each slot has a combination value determining lottery odds
4. Running the lottery uses Plackett-Luce model (sampling without replacement)
5. Results animate from worst pick to winner for dramatic effect

### Key Modules

**`src/App.jsx`** - Main application state and UI orchestration. Manages:
- DnD context for swapping teams between lottery slots and playoff positions
- Lottery slot system (slots hold combinations, teams are assigned to slots)
- Animation state machine for lottery reveal sequence

**`src/services/sleeperApi.js`** - Sleeper API integration:
- Fetches league info, users, rosters, matchups, drafts
- Calculates Points Against by aggregating opponent scores across all weeks (resource-intensive, controlled by `POINTS_AGAINST.ENABLED`)
- Avatar URL construction from Sleeper CDN

**`src/utils/nbaLottery.js`** - Lottery algorithm implementing Plackett-Luce model:
- `selectWinnerByCombinations()` - Single weighted random selection
- `runNBALottery()` - Full lottery execution with selection from Pick #1 to last pick
- Selection order is winner-first, display order is reversed for dramatic reveal

**`src/utils/combinations.js`** - Combination distribution calculations for different lottery styles (NBA, Equal, Linear, Exponential)

**`src/constants/index.js`** - Configuration including:
- Sleeper API endpoints
- Predefined combination distributions (NBA 6/12/14 teams, Equal, Linear, etc.)
- `POINTS_AGAINST.ENABLED` toggle for expensive matchup calculations

### Component Architecture

- `DraggableAndDroppableTeamCard` / `DroppablePlayoffTeam` - DnD components for team placement
- `SelectionAnimation` - Full-screen lottery reveal with confetti
- `LotteryResults` - Final draft order display
- `TeamNameWithAvatar` / `TeamAvatar` - Consistent team display components

### Lottery Slot System

Lottery uses a slot-based architecture where:
- Slots have fixed combination values (odds)
- Teams are assigned to slots via drag-and-drop
- Swapping teams moves them between slots without changing combinations
- "Lottery-only" modes (e.g., NBA 6 Teams) exclude playoff teams from slots
