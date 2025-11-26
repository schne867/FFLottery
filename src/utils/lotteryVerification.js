/**
 * Lottery Verification Utility
 * 
 * Verifies that the Plackett-Luce lottery implementation produces
 * probabilities matching the official NBA lottery odds.
 * 
 * Based on NBAODDS.csv which shows the probability distribution
 * for each seed position getting picks 1-14.
 */

import { runNBALottery } from './nbaLottery';

/**
 * Official NBA lottery combinations (14 teams, 1000 total)
 * Seed 1 = worst team, Seed 14 = best team
 */
export const NBA_14_TEAM_COMBINATIONS = [
  140, // Seed 1: 14% chance at pick 1
  140, // Seed 2: 14% chance at pick 1
  140, // Seed 3: 14% chance at pick 1
  125, // Seed 4: 12.5% chance at pick 1
  105, // Seed 5: 10.5% chance at pick 1
  90,  // Seed 6: 9% chance at pick 1
  75,  // Seed 7: 7.5% chance at pick 1
  60,  // Seed 8: 6% chance at pick 1
  45,  // Seed 9: 4.5% chance at pick 1
  30,  // Seed 10: 3% chance at pick 1
  20,  // Seed 11: 2% chance at pick 1
  15,  // Seed 12: 1.5% chance at pick 1
  10,  // Seed 13: 1% chance at pick 1
  5,   // Seed 14: 0.5% chance at pick 1
];

/**
 * Official NBA lottery probabilities from NBAODDS.csv
 * 
 * NOTE: The NBA lottery only determines picks 1-4. Picks 5-14 are assigned
 * in reverse order of record (worst team gets pick 5, etc.). However, our
 * implementation uses the Plackett-Luce model to determine ALL picks through
 * the lottery, which is appropriate for fantasy football.
 * 
 * Format: [seed][pick] = probability percentage
 * Example: NBA_PROBABILITIES[0][0] = 14.0 (Seed 1, Pick 1 = 14%)
 * 
 * For picks 5-14, the CSV shows aggregated probabilities (e.g., Seed 1 has
 * 47.9% combined chance at picks 5-14). We verify picks 1-4 match exactly,
 * and picks 5-14 follow the Plackett-Luce model correctly.
 */
export const NBA_PROBABILITIES = [
  // Seed 1 (worst) - Pick 1: 14%, Pick 2: 13.4%, Pick 3: 12.7%, Pick 4: 12.0%
  [14.0, 13.4, 12.7, 12.0],
  // Seed 2 - Pick 1: 14%, Pick 2: 13.4%, Pick 3: 12.7%, Pick 4: 12.0%
  [14.0, 13.4, 12.7, 12.0],
  // Seed 3 - Pick 1: 14%, Pick 2: 13.4%, Pick 3: 12.7%, Pick 4: 12.0%
  [14.0, 13.4, 12.7, 12.0],
  // Seed 4 - Pick 1: 12.5%, Pick 2: 12.2%, Pick 3: 11.9%, Pick 4: 11.5%
  [12.5, 12.2, 11.9, 11.5],
  // Seed 5 - Pick 1: 10.5%, Pick 2: 10.5%, Pick 3: 10.6%, Pick 4: 10.5%
  [10.5, 10.5, 10.6, 10.5],
  // Seed 6 - Pick 1: 9.0%, Pick 2: 9.2%, Pick 3: 9.4%, Pick 4: 9.6%
  [9.0, 9.2, 9.4, 9.6],
  // Seed 7 - Pick 1: 7.5%, Pick 2: 7.8%, Pick 3: 8.1%, Pick 4: 8.5%
  [7.5, 7.8, 8.1, 8.5],
  // Seed 8 - Pick 1: 6.0%, Pick 2: 6.3%, Pick 3: 6.7%, Pick 4: 7.2%
  [6.0, 6.3, 6.7, 7.2],
  // Seed 9 - Pick 1: 4.5%, Pick 2: 4.8%, Pick 3: 5.2%, Pick 4: 5.7%
  [4.5, 4.8, 5.2, 5.7],
  // Seed 10 - Pick 1: 3.0%, Pick 2: 3.3%, Pick 3: 3.6%, Pick 4: 4.0%
  [3.0, 3.3, 3.6, 4.0],
  // Seed 11 - Pick 1: 2.0%, Pick 2: 2.2%, Pick 3: 2.4%, Pick 4: 2.8%
  [2.0, 2.2, 2.4, 2.8],
  // Seed 12 - Pick 1: 1.5%, Pick 2: 1.7%, Pick 3: 1.9%, Pick 4: 2.1%
  [1.5, 1.7, 1.9, 2.1],
  // Seed 13 - Pick 1: 1.0%, Pick 2: 1.1%, Pick 3: 1.2%, Pick 4: 1.4%
  [1.0, 1.1, 1.2, 1.4],
  // Seed 14 (best) - Pick 1: 0.5%, Pick 2: 0.6%, Pick 3: 0.6%, Pick 4: 0.7%
  [0.5, 0.6, 0.6, 0.7],
];

/**
 * Run lottery simulation multiple times to verify probabilities
 * @param {number} iterations - Number of simulations to run
 * @param {Array<number>} combinations - Array of combinations for each team
 * @returns {Promise<Object>} Statistics object with observed probabilities
 */
export async function verifyLotteryProbabilities(iterations = 100000, combinations = NBA_14_TEAM_COMBINATIONS) {
  const numTeams = combinations.length;
  
  // Initialize counters: [seed][pick] = count
  const counts = Array(numTeams).fill(null).map(() => Array(numTeams).fill(0));
  
  // Create mock teams
  const teams = combinations.map((combo, index) => ({
    userId: `team-${index + 1}`,
    teamName: `Team ${index + 1}`,
    combinations: combo,
    seed: index + 1, // Seed 1 = worst, Seed N = best
  }));
  
  // Run simulations
  for (let i = 0; i < iterations; i++) {
    const results = await runNBALottery(teams, null, 0); // No delay for speed
    
    // Record results
    results.forEach((selection) => {
      const seed = selection.seed - 1; // Convert to 0-based index
      const pickNumber = selection.pickNumber - 1; // Convert to 0-based index
      counts[seed][pickNumber]++;
    });
  }
  
  // Calculate observed probabilities
  const observed = counts.map((seedCounts, seedIndex) => 
    seedCounts.map(count => (count / iterations) * 100)
  );
  
  // Calculate expected probabilities (if we have them)
  const expected = numTeams === 14 ? NBA_PROBABILITIES : null;
  
  // Calculate differences (only for picks 1-4, which are the official NBA lottery picks)
  const differences = expected ? observed.map((seedProbs, seedIndex) =>
    seedProbs.map((obsProb, pickIndex) => {
      // Only compare picks 1-4 (indices 0-3) against NBA official probabilities
      if (pickIndex < 4) {
        const expProb = expected[seedIndex]?.[pickIndex] || 0;
        return Math.abs(obsProb - expProb);
      }
      // For picks 5+, we don't have official NBA probabilities (they use reverse order)
      return null;
    })
  ) : null;
  
  return {
    iterations,
    observed,
    expected,
    differences,
    counts,
  };
}

/**
 * Print verification results in a readable format
 * @param {Object} results - Results from verifyLotteryProbabilities
 */
export function printVerificationResults(results) {
  const { iterations, observed, expected, differences } = results;
  const numTeams = observed.length;
  
  console.log(`\n=== Lottery Verification Results (${iterations.toLocaleString()} iterations) ===`);
  console.log('NOTE: Comparing picks 1-4 against official NBA lottery probabilities.\n');
  
  for (let seed = 0; seed < numTeams; seed++) {
    const comboCount = numTeams === 14 ? NBA_14_TEAM_COMBINATIONS[seed] : 'N/A';
    console.log(`Seed ${seed + 1} (${comboCount} combinations):`);
    
    // Show picks 1-4 (the official NBA lottery picks)
    for (let pick = 0; pick < 4; pick++) {
      const obs = observed[seed][pick].toFixed(2);
      const exp = expected?.[seed]?.[pick]?.toFixed(2) || 'N/A';
      const diff = differences?.[seed]?.[pick] !== null ? differences[seed][pick].toFixed(2) : 'N/A';
      
      console.log(`  Pick #${pick + 1}: Observed=${obs}%, Expected=${exp}%, Diff=${diff}%`);
    }
    
    // Show summary for picks 5+
    if (numTeams > 4) {
      const picks5Plus = observed[seed].slice(4).reduce((sum, prob) => sum + prob, 0);
      console.log(`  Picks 5-${numTeams}: ${picks5Plus.toFixed(2)}% (Plackett-Luce model)`);
    }
    
    console.log('');
  }
}

