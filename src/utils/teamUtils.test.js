import { describe, expect, it } from 'vitest';
import { selectLotteryTeams } from './teamUtils';

// Team i has i wins: t0 is the worst team
const league = count =>
  Array.from({ length: count }, (_, i) => ({ userId: `t${i}`, wins: i, losses: count - i, ties: 0, pointsFor: 1000 + i }));
const ids = teams => teams.map(team => team.userId);

describe('selectLotteryTeams', () => {
  it('uses only non-playoff teams for lottery-only options, worst first', () => {
    expect(ids(selectLotteryTeams(league(12), true))).toEqual(['t0', 't1', 't2', 't3', 't4', 't5']);
  });

  it('uses every team, worst first, for whole-league options', () => {
    expect(ids(selectLotteryTeams(league(8), false))).toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7']);
  });

  it('caps the lottery at the 12 worst teams', () => {
    expect(ids(selectLotteryTeams(league(14), false))).toEqual(ids(league(12)));
  });
});
