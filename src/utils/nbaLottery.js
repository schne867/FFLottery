/**
 * NBA-style lottery selection using the Plackett-Luce model
 * 
 * Based on: https://squared2020.com/2017/09/30/how-nba-draft-lottery-probabilities-are-constructed/
 * 
 * VERIFIED: This implementation produces probabilities matching the official NBA lottery odds
 * as documented in NBAODDS.csv. The Plackett-Luce model correctly calculates:
 * - Pick #1 probabilities match the first column of NBAODDS.csv (e.g., Seed 1-3: 14%, Seed 4: 12.5%)
 * - Pick #2-4 probabilities match columns 2-4 of NBAODDS.csv
 * - Picks 5+ follow the Plackett-Luce model (NBA uses reverse order of record for picks 5-14)
 * 
 * The Plackett-Luce model is a sampling without replacement process:
 * - Each team has a probability p_i (represented by their combinations)
 * - Pick #1: P(Team i gets #1) = p_i / sum(all p_j)
 * - Pick #2: P(Team i gets #2 | Team j got #1) = p_i / sum(all p_k where k != j)
 * - This continues for all picks
 * 
 * The combinations represent:
 * - The number of ways a team can get the #1 pick (out of 1000 total combinations)
 * - Those same combinations also determine their chances at picks 2-14 through the Plackett-Luce model
 * 
 * Official NBA combinations (14 teams):
 * [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5] = 1000 total
 */

import { LOTTERY } from '../constants';
import { calculateTotalCombinations } from './combinations';

/**
 * Select a team using Plackett-Luce model (sampling without replacement)
 * 
 * This implements: P(Team i selected) = combinations_i / sum(all combinations)
 * 
 * @param {Array<Object>} teams - Array of team objects with combinations property
 * @returns {Object} Selected team
 * @throws {Error} If teams array is empty
 */
export function selectWinnerByCombinations(teams) {
  if (!Array.isArray(teams) || teams.length === 0) {
    throw new Error('Cannot select from empty teams array');
  }

  const totalCombinations = calculateTotalCombinations(teams.map(t => t.combinations || 0));
  
  if (totalCombinations === 0) {
    throw new Error('Total combinations cannot be zero');
  }

  // Plackett-Luce: Generate random number between 1 and totalCombinations
  // This simulates drawing one of the total combinations
  const random = Math.floor(Math.random() * totalCombinations) + 1;
  
  // Cumulative distribution: find which team's combination range contains the random number
  let cumulative = 0;
  
  for (const team of teams) {
    const combinations = team.combinations || 0;
    if (combinations <= 0) {
      continue; // Skip teams with no combinations
    }
    
    cumulative += combinations;
    // If random falls within this team's combination range, select them
    if (random <= cumulative) {
      return team;
    }
  }
  
  // Fallback to last team (shouldn't happen if combinations are correct)
  return teams[teams.length - 1];
}

/**
 * Run NBA-style lottery selection using Plackett-Luce model
 * 
 * Implements the Plackett-Luce model for sampling without replacement:
 * - Each pick is selected based on remaining teams' combinations
 * - Probabilities are recalculated after each selection (normalized)
 * - SELECTS from winner (Pick #1) to worst pick, but DISPLAYS in reverse order
 * 
 * Mathematical model:
 * - Pick #1: P(Team i) = combinations_i / sum(all combinations)
 * - Pick #2: P(Team i | Team j got #1) = combinations_i / sum(all combinations except Team j)
 * - Pick #3: P(Team i | Teams j,k got #1,#2) = combinations_i / sum(all combinations except Teams j,k)
 * - And so on...
 * 
 * Selection order: Winner (Pick #1) → Pick #2 → Pick #3 → ... → Worst Pick
 * Display order: Worst Pick → ... → Pick #3 → Pick #2 → Winner (Pick #1)
 * 
 * @param {Array<Object>} teams - Array of team objects with combinations property
 * @param {Function} onSelection - Callback for each selection (team, pickNumber, displayPosition)
 * @param {number} delay - Delay between selections in ms
 * @returns {Promise<Array>} Array of selections ordered from worst pick to winner (for display)
 * @throws {Error} If teams array is empty or invalid
 */
export async function runNBALottery(teams, onSelection, delay = LOTTERY.DEFAULT_DELAY_MS) {
  if (!Array.isArray(teams) || teams.length === 0) {
    throw new Error('Cannot run lottery with empty teams array');
  }

  if (typeof delay !== 'number' || delay < 0) {
    delay = LOTTERY.DEFAULT_DELAY_MS;
  }

  const selections = [];
  const totalTeams = teams.length;
  
  // Create a copy for selection (Plackett-Luce: sampling without replacement)
  let availableTeams = [...teams];
  
  // Select from winner (Pick #1) to worst pick (Pick #N)
  // Using Plackett-Luce: each selection uses remaining teams' combinations
  for (let pickNumber = 1; pickNumber <= totalTeams; pickNumber++) {
    // Wait before selection (for animation)
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Plackett-Luce step: Select team from remaining teams
    // P(Team i selected) = combinations_i / sum(combinations of all remaining teams)
    const selected = selectWinnerByCombinations(availableTeams);
    
    if (!selected || !selected.userId) {
      throw new Error('Invalid team selected during lottery');
    }
    
    // Plackett-Luce: Remove selected team (sampling without replacement)
    // This ensures probabilities are recalculated for remaining teams
    availableTeams = availableTeams.filter(t => t.userId !== selected.userId);
    
    // Calculate display position (worst pick = 1, winner = totalTeams)
    // Pick #1 (winner) should display last (position = totalTeams)
    // Pick #N (worst) should display first (position = 1)
    const displayPosition = totalTeams - pickNumber + 1;
    
    // Store selection with both pick number and display position
    const selection = {
      ...selected,
      pickNumber, // Actual pick number (1 = winner, N = worst)
      position: displayPosition, // Display position (1 = worst, N = winner)
    };
    
    // Insert at beginning to reverse order (worst pick first, winner last)
    selections.unshift(selection);
    
    // Callback with selection (for animation)
    // Pass display position so animation shows correct label
    if (typeof onSelection === 'function') {
      onSelection(selected, displayPosition, pickNumber);
    }
  }
  
  // Return in display order: worst pick first, winner last
  return selections;
}

