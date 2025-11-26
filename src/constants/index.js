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
  TOTAL_COMBINATIONS: 1000,
  // Default NBA-style combination distribution for 12 teams
  // Worst team (position 1) gets most combinations, best team gets least
  DEFAULT_COMBINATIONS: [155, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15],
  // Predefined combination sets
  COMBINATION_SETS: {
    NBA_6_TEAMS: {
      name: 'NBA Style (6 Teams)',
      // Scaled from 12-team: positions 7-12 (worst lottery team = 7th overall, best lottery team = 12th overall)
      // Original: [75, 60, 45, 30, 20, 15] = 245 total, scaled to 1000
      combinations: [306, 245, 184, 122, 82, 61],
      total: 1000,
      lotteryOnly: true, // Only non-playoff teams eligible
    },
    NBA_12_TEAMS: {
      name: 'NBA Style (12 Teams)',
      // Official NBA values for positions 1-12, with teams 13-14 combinations (10+5=15) added to team 1
      combinations: [155, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15],
      total: 1000,
    },
    NBA_14_TEAMS: {
      name: 'NBA Style (14 Teams) - Official',
      // Official NBA lottery combinations (exact values from NBA)
      // Seed 1-3: 140 each (14% chance at pick 1)
      // Seed 4: 125 (12.5%), Seed 5: 105 (10.5%), Seed 6: 90 (9%), Seed 7: 75 (7.5%)
      // Seed 8: 60 (6%), Seed 9: 45 (4.5%), Seed 10: 30 (3%), Seed 11: 20 (2%)
      // Seed 12: 15 (1.5%), Seed 13: 10 (1%), Seed 14: 5 (0.5%)
      combinations: [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5],
      total: 1000,
    },
    EQUAL: {
      name: 'Equal Distribution',
      combinations: null, // Will be calculated based on team count
      total: 1000,
    },
    LINEAR: {
      name: 'Linear Distribution',
      combinations: null, // Will be calculated based on team count
      total: 1000,
    },
    EXPONENTIAL: {
      name: 'Exponential Distribution',
      combinations: null, // Will be calculated based on team count
      total: 1000,
    },
    CUSTOM: {
      name: 'Custom',
      combinations: null, // User-defined, defaults to NBA style
      total: 1000,
    },
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

