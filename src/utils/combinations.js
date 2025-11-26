/**
 * NBA-style lottery combination utilities
 */

import { LOTTERY } from '../constants';

/**
 * Get default combinations for a given number of teams
 * @param {number} numTeams - Number of teams
 * @returns {Array<number>} Array of combination counts (worst to best)
 */
export function getDefaultCombinations(numTeams) {
  if (numTeams <= LOTTERY.DEFAULT_COMBINATIONS.length) {
    return LOTTERY.DEFAULT_COMBINATIONS.slice(0, numTeams);
  }
  
  // If more teams than default, extend with smaller values
  const extended = [...LOTTERY.DEFAULT_COMBINATIONS];
  const remaining = numTeams - LOTTERY.DEFAULT_COMBINATIONS.length;
  for (let i = 0; i < remaining; i++) {
    extended.push(Math.max(1, Math.floor(extended[extended.length - 1] * 0.8)));
  }
  
  return extended;
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

/**
 * Generate equal distribution combinations
 * 
 * IMPORTANT: All combination arrays follow the same pattern:
 * - Index 0 = worst team (gets most combinations = highest chance at Pick #1)
 * - Index N-1 = best team (gets least combinations = lowest chance at Pick #1)
 * 
 * The lottery selects Pick #1 (winner) FIRST, then Pick #2, Pick #3, etc.
 * But displays results in reverse order (worst pick first, winner last).
 * 
 * @param {number} numTeams - Number of teams
 * @param {number} total - Total combinations (default 1000)
 * @returns {Array<number>} Array of equal combination counts (worst to best)
 */
export function generateEqualCombinations(numTeams, total = 1000) {
  const base = Math.floor(total / numTeams);
  const remainder = total % numTeams;
  const combinations = Array(numTeams).fill(base);
  
  // Distribute remainder to first teams (worst teams get slightly more)
  for (let i = 0; i < remainder; i++) {
    combinations[i]++;
  }
  
  return combinations;
}

/**
 * Generate linear distribution combinations
 * 
 * IMPORTANT: All combination arrays follow the same pattern:
 * - Index 0 = worst team (gets most combinations = highest chance at Pick #1)
 * - Index N-1 = best team (gets least combinations = lowest chance at Pick #1)
 * 
 * The lottery selects Pick #1 (winner) FIRST, then Pick #2, Pick #3, etc.
 * But displays results in reverse order (worst pick first, winner last).
 * 
 * @param {number} numTeams - Number of teams
 * @param {number} total - Total combinations (default 1000)
 * @returns {Array<number>} Array of combination counts (worst to best)
 */
export function generateLinearCombinations(numTeams, total = 1000) {
  // Calculate sum of 1+2+3+...+n = n*(n+1)/2
  const sum = (numTeams * (numTeams + 1)) / 2;
  const combinations = [];
  
  for (let i = 0; i < numTeams; i++) {
    // Worst team (i=0) gets numTeams shares, best gets 1 share
    const shares = numTeams - i;
    combinations.push(Math.round((shares / sum) * total));
  }
  
  // Adjust to ensure total is exactly correct
  const currentTotal = calculateTotalCombinations(combinations);
  const difference = total - currentTotal;
  if (difference !== 0) {
    combinations[0] += difference; // Add/subtract difference from worst team
  }
  
  return combinations;
}

/**
 * Generate exponential distribution combinations
 * 
 * IMPORTANT: All combination arrays follow the same pattern:
 * - Index 0 = worst team (gets most combinations = highest chance at Pick #1)
 * - Index N-1 = best team (gets least combinations = lowest chance at Pick #1)
 * 
 * The lottery selects Pick #1 (winner) FIRST, then Pick #2, Pick #3, etc.
 * But displays results in reverse order (worst pick first, winner last).
 * 
 * @param {number} numTeams - Number of teams
 * @param {number} total - Total combinations (default 1000)
 * @returns {Array<number>} Array of combination counts (worst to best)
 */
export function generateExponentialCombinations(numTeams, total = 1000) {
  // Use exponential weights: 2^(n-i) for team i (worst team i=0 gets 2^n)
  const combinations = [];
  let sum = 0;
  
  // Calculate weights
  for (let i = 0; i < numTeams; i++) {
    const weight = Math.pow(2, numTeams - i - 1);
    combinations.push(weight);
    sum += weight;
  }
  
  // Scale to total
  for (let i = 0; i < numTeams; i++) {
    combinations[i] = Math.round((combinations[i] / sum) * total);
  }
  
  // Adjust to ensure total is exactly correct
  const currentTotal = calculateTotalCombinations(combinations);
  const difference = total - currentTotal;
  if (difference !== 0) {
    combinations[0] += difference; // Add/subtract difference from worst team
  }
  
  return combinations;
}

/**
 * Get combination set by key
 * 
 * IMPORTANT: All combination arrays returned follow the same pattern:
 * - Index 0 = worst team (gets most combinations = highest chance at Pick #1)
 * - Index N-1 = best team (gets least combinations = lowest chance at Pick #1)
 * 
 * The lottery selects Pick #1 (winner) FIRST, then Pick #2, Pick #3, etc.
 * But displays results in reverse order (worst pick first, winner last).
 * 
 * @param {string} setKey - Key of the combination set
 * @param {number} numTeams - Number of teams
 * @returns {Array<number>} Array of combination counts (worst to best)
 */
export function getCombinationSet(setKey, numTeams) {
  const set = LOTTERY.COMBINATION_SETS[setKey];
  if (!set) {
    return getDefaultCombinations(numTeams);
  }
  
  if (set.combinations) {
    // Fixed set (like NBA_12_TEAMS)
    if (numTeams <= set.combinations.length) {
      return set.combinations.slice(0, numTeams);
    }
    // Extend if more teams
    const extended = [...set.combinations];
    const remaining = numTeams - set.combinations.length;
    for (let i = 0; i < remaining; i++) {
      extended.push(Math.max(1, Math.floor(extended[extended.length - 1] * 0.8)));
    }
    return extended;
  }
  
  // Dynamic sets
  switch (setKey) {
    case 'EQUAL':
      return generateEqualCombinations(numTeams, set.total);
    case 'LINEAR':
      return generateLinearCombinations(numTeams, set.total);
    case 'EXPONENTIAL':
      return generateExponentialCombinations(numTeams, set.total);
    default:
      return getDefaultCombinations(numTeams);
  }
}
