/**
 * Application constants
 */

export const SLEEPER_API = {
  BASE_URL: 'https://api.sleeper.app/v1',
  ENDPOINTS: {
    LEAGUE: (id) => `/league/${id}`,
    LEAGUE_USERS: (id) => `/league/${id}/users`,
    LEAGUE_ROSTERS: (id) => `/league/${id}/rosters`,
    LEAGUE_MATCHUPS: (id, week) => `/league/${id}/matchups/${week}`,
    LEAGUE_DRAFTS: (id) => `/league/${id}/drafts`,
    DRAFT: (id) => `/draft/${id}`,
    DRAFT_PICKS: (id) => `/draft/${id}/picks`,
    USER: (id) => `/user/${id}`,
    NFL_STATE: () => '/state/nfl',
  },
};

export const POINTS_AGAINST = {
  /**
   * Points Against Calculation Settings
   * 
   * IMPORTANT: Points Against is NOT directly available from Sleeper API.
   * It must be calculated by fetching matchups for all weeks and summing opponent points.
   * 
   * This requires multiple API calls (up to 18 weeks), so it's resource-intensive.
   * Set ENABLED to false to skip this calculation and improve performance.
   * 
   * Points For (PF) IS directly available via roster.settings.fpts - no calculation needed.
   */
  // Set to false to skip Points Against calculation (saves ~18 API calls)
  ENABLED: true,
  // Maximum weeks to fetch (will optimize to current week if NFL state is available)
  MAX_WEEKS: 18,
};

export const LOTTERY = {
  DEFAULT_DELAY_MS: 1500,
  MIN_ODDS: 0,
  DEFAULT_ODDS: 1,
  // Largest lottery the app supports; extra teams are left out (best records first)
  MAX_TEAMS: 12,
  // Odds options. Each works for any lottery size (1 to MAX_TEAMS); the rules live in
  // utils/combinations.js. lotteryOnly = only non-playoff teams are in the lottery.
  COMBINATION_SETS: {
    TIERED_421: { name: 'Tiered 4-2-1 (each third half the odds)', lotteryOnly: true },
    TIERED_321: { name: 'Tiered 3-2-1', lotteryOnly: true },
    NBA: { name: 'NBA (2019–present)', lotteryOnly: true },
    NBA_CLASSIC: { name: 'NBA Classic (1994–2018)', lotteryOnly: true },
    NHL: { name: 'NHL', lotteryOnly: true },
    MLB: { name: 'MLB', lotteryOnly: true },
    LINEAR: { name: 'Linear', lotteryOnly: false },
    EQUAL: { name: 'Equal', lotteryOnly: false },
    CUSTOM: { name: 'Custom', lotteryOnly: false },
  },
};

export const VALIDATION = {
  LEAGUE_ID_MIN_LENGTH: 1,
};

export const UI = {
  ANIMATION: {
    SELECTION_DELAY_MS: 1500,
  },
};

