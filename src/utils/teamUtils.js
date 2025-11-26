/**
 * Team-related utility functions
 */

/**
 * Calculate win percentage for a team
 * @param {Object} team - Team object with wins, losses, ties
 * @returns {number} Win percentage (0-1)
 */
export function calculateWinPercentage(team) {
  const { wins = 0, losses = 0, ties = 0 } = team;
  const totalGames = wins + losses + ties;
  return totalGames > 0 ? wins / totalGames : 0;
}

/**
 * Sort teams by record (worst to best)
 * If tied on win percentage, sort by points for (lower points = worse)
 * @param {Array<Object>} teams - Array of team objects
 * @returns {Array<Object>} Sorted teams array
 */
export function sortTeamsByRecord(teams) {
  return [...teams].sort((a, b) => {
    const winPctA = calculateWinPercentage(a);
    const winPctB = calculateWinPercentage(b);
    
    // First sort by win percentage (lower = worse)
    if (winPctA !== winPctB) {
      return winPctA - winPctB;
    }
    
    // If win percentage is tied, sort by points for (lower = worse)
    const pointsForA = a.pointsFor || 0;
    const pointsForB = b.pointsFor || 0;
    return pointsForA - pointsForB;
  });
}

/**
 * Sort teams by record (best to worst) for playoff determination
 * If tied on win percentage, sort by points for (higher points = better)
 * @param {Array<Object>} teams - Array of team objects
 * @returns {Array<Object>} Sorted teams array (best first)
 */
export function sortTeamsByRecordBestFirst(teams) {
  return [...teams].sort((a, b) => {
    const winPctA = calculateWinPercentage(a);
    const winPctB = calculateWinPercentage(b);
    
    // First sort by win percentage (higher = better)
    if (winPctA !== winPctB) {
      return winPctB - winPctA;
    }
    
    // If win percentage is tied, sort by points for (higher = better)
    // Team with more Points For makes playoffs
    const pointsForA = a.pointsFor || 0;
    const pointsForB = b.pointsFor || 0;
    return pointsForB - pointsForA;
  });
}

/**
 * Determine lottery teams (non-playoff teams)
 * Top 6 teams make playoffs, bottom 6 are lottery teams
 * If tied for 6th playoff spot, team with higher Points For makes playoffs
 * @param {Array<Object>} teams - Array of team objects
 * @param {number} playoffSpots - Number of playoff spots (default 6)
 * @returns {Object} Object with playoffTeams and lotteryTeams arrays
 */
export function determinePlayoffAndLotteryTeams(teams, playoffSpots = 6) {
  if (!Array.isArray(teams) || teams.length === 0) {
    return {
      playoffTeams: [],
      lotteryTeams: [],
    };
  }
  
  // Sort teams best to worst for playoff determination
  const sortedBestFirst = sortTeamsByRecordBestFirst(teams);
  
  // Top teams make playoffs
  const playoffTeams = sortedBestFirst.slice(0, playoffSpots);
  
  // Remaining teams are lottery teams (sorted worst to best for lottery)
  const lotteryTeams = sortedBestFirst.slice(playoffSpots);
  
  // Sort lottery teams worst to best for lottery assignment
  const sortedLotteryTeams = sortTeamsByRecord(lotteryTeams);
  
  return {
    playoffTeams,
    lotteryTeams: sortedLotteryTeams,
  };
}

/**
 * Initialize default combinations based on team records (NBA-style)
 * @param {Array<Object>} teams - Array of team objects
 * @returns {Object} Object mapping userId to combination count
 */
export function initializeDefaultCombinations(teams) {
  const sortedTeams = sortTeamsByRecord(teams);
  const combinations = {};
  
  // Get default NBA-style combination distribution
  const defaultCombos = getDefaultCombinations(sortedTeams.length);
  
  sortedTeams.forEach((team, index) => {
    // Worst team (index 0) gets most combinations
    combinations[team.userId] = defaultCombos[index] || 1;
  });
  
  return combinations;
}

/**
 * Get default combinations for a given number of teams
 * @param {number} numTeams - Number of teams
 * @returns {Array<number>} Array of combination counts (worst to best)
 */
function getDefaultCombinations(numTeams) {
  // NBA-style distribution for 12 teams (with extra combinations from teams 13-14 added to team 1)
  const default12 = [155, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15];
  
  if (numTeams <= default12.length) {
    return default12.slice(0, numTeams);
  }
  
  // If more teams than 12, extend with smaller values
  const extended = [...default12];
  const remaining = numTeams - default12.length;
  for (let i = 0; i < remaining; i++) {
    extended.push(Math.max(1, Math.floor(extended[extended.length - 1] * 0.8)));
  }
  
  return extended;
}

/**
 * Format team record string
 * @param {Object} team - Team object with wins, losses, ties
 * @returns {string} Formatted record string
 */
export function formatTeamRecord(team) {
  const { wins = 0, losses = 0, ties = 0 } = team;
  let record = `${wins}-${losses}`;
  if (ties > 0) {
    record += `-${ties}`;
  }
  return record;
}

