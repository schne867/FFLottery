/**
 * Lottery odds ("combinations") for every option in LOTTERY.COMBINATION_SETS.
 *
 * All combination arrays follow the same pattern:
 * - Index 0 = worst team (most combinations = highest chance at Pick #1)
 * - Index N-1 = best team (fewest combinations)
 * Only the ratios matter: the lottery draws each pick with probability combinations / total.
 */

import { LOTTERY } from '../constants';

// Real leagues' #1-pick combinations, worst seed first. A lottery of N teams uses the
// league's real numbers for its N worst seeds.
const LEAGUE_CURVES = {
  // NBA since 2019: worst three tied at 14%
  NBA: [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5],
  // NBA 1994-2018: worst team 25%
  NBA_CLASSIC: [250, 199, 156, 119, 88, 63, 43, 28, 17, 11, 8, 7, 6, 5],
  // NHL (16 teams): worst team 18.5%
  NHL: [185, 135, 115, 95, 85, 75, 65, 60, 50, 35, 30, 25, 20, 15, 5, 5],
  // MLB (18 teams): worst three tied at 16.5%
  MLB: [165, 165, 165, 132, 100, 75, 55, 39, 27, 18, 14, 11, 9, 8, 6, 5, 4, 2],
};

/**
 * Split `count` teams into tiers as evenly as possible (extra teams go to the worst tiers),
 * returning each team's tier weight.
 */
export function splitIntoTiers(count, tierWeights) {
  const baseSize = Math.floor(count / tierWeights.length);
  const extra = count % tierWeights.length;
  return tierWeights.flatMap((weight, tier) => Array(baseSize + (tier < extra ? 1 : 0)).fill(weight));
}

// Scale weights to about 1000 whole combinations; every team keeps at least 1 so it stays drawable
function toCombinations(weights) {
  const sum = weights.reduce((total, weight) => total + weight, 0);
  return weights.map(weight => Math.max(1, Math.round((weight / sum) * 1000)));
}

const RULES = {
  TIERED_421: count => splitIntoTiers(count, [400, 200, 100]),
  TIERED_321: count => splitIntoTiers(count, [300, 200, 100]),
  NBA: count => LEAGUE_CURVES.NBA.slice(0, count),
  NBA_CLASSIC: count => LEAGUE_CURVES.NBA_CLASSIC.slice(0, count),
  NHL: count => LEAGUE_CURVES.NHL.slice(0, count),
  MLB: count => LEAGUE_CURVES.MLB.slice(0, count),
  LINEAR: count => toCombinations(Array.from({ length: count }, (_, i) => count - i)),
  EQUAL: count => Array(count).fill(100),
};

/**
 * Combinations for a lottery of `numTeams` teams under the given option (worst team first).
 * Custom and unknown options start from NBA odds.
 */
export function getCombinationSet(setKey, numTeams) {
  const count = Math.min(numTeams, LOTTERY.MAX_TEAMS);
  if (count <= 0) return [];
  const rule = RULES[setKey] || RULES.NBA;
  return rule(count);
}

/**
 * Calculate total combinations
 * @param {Array<number>} combinations - Array of combination counts
 * @returns {number} Total combinations
 */
export function calculateTotalCombinations(combinations) {
  return combinations.reduce((sum, count) => sum + (count || 0), 0);
}

/**
 * Calculate percentage chance for each team
 * @param {Array<number>} combinations - Array of combination counts
 * @returns {Array<number>} Array of percentages
 */
export function calculatePercentages(combinations) {
  const total = calculateTotalCombinations(combinations);
  if (total === 0) return combinations.map(() => 0);
  
  return combinations.map(count => ((count || 0) / total) * 100);
}

/**
 * Validate combinations array
 * @param {Array<number>} combinations - Array of combination counts
 * @returns {Object} Validation result with isValid and error message
 */
export function validateCombinations(combinations) {
  if (!Array.isArray(combinations)) {
    return { isValid: false, error: 'Combinations must be an array' };
  }
  
  if (combinations.length === 0) {
    return { isValid: false, error: 'At least one team required' };
  }
  
  const invalid = combinations.some(count => typeof count !== 'number' || count < 0);
  if (invalid) {
    return { isValid: false, error: 'All combination values must be non-negative numbers' };
  }
  
  const total = calculateTotalCombinations(combinations);
  if (total === 0) {
    return { isValid: false, error: 'Total combinations cannot be zero' };
  }
  
  return { isValid: true, error: null };
}
