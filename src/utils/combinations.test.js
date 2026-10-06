import { describe, expect, it } from 'vitest';
import { LOTTERY } from '../constants';
import { calculateTotalCombinations, getCombinationSet, splitIntoTiers } from './combinations';

const percentages = combos => {
  const total = calculateTotalCombinations(combos);
  return combos.map(c => Number(((c / total) * 100).toFixed(1)));
};

describe('every combination option', () => {
  const setKeys = Object.keys(LOTTERY.COMBINATION_SETS);

  it('offers the agreed options', () => {
    expect(setKeys).toEqual([
      'TIERED_421',
      'TIERED_321',
      'NBA',
      'NBA_CLASSIC',
      'NHL',
      'MLB',
      'LINEAR',
      'EQUAL',
      'CUSTOM',
    ]);
  });

  it.each(setKeys)('%s gives every lottery size from 1 to 12 positive whole-number odds, worst team first', key => {
    for (let n = 1; n <= LOTTERY.MAX_TEAMS; n++) {
      const combos = getCombinationSet(key, n);
      expect(combos).toHaveLength(n);
      for (const c of combos) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(1);
      }
      for (let i = 1; i < n; i++) expect(combos[i]).toBeLessThanOrEqual(combos[i - 1]);
    }
  });

  it('caps the lottery at 12 teams', () => {
    expect(LOTTERY.MAX_TEAMS).toBe(12);
  });
});

describe('tiered options', () => {
  it('4-2-1 halves the odds for each third, with round numbers', () => {
    expect(getCombinationSet('TIERED_421', 6)).toEqual([400, 400, 200, 200, 100, 100]);
    expect(percentages(getCombinationSet('TIERED_421', 6))).toEqual([28.6, 28.6, 14.3, 14.3, 7.1, 7.1]);
  });

  it('3-2-1 uses 3 : 2 : 1 thirds', () => {
    expect(getCombinationSet('TIERED_321', 6)).toEqual([300, 300, 200, 200, 100, 100]);
  });

  it('gives the extra teams of an uneven split to the worst tiers', () => {
    expect(getCombinationSet('TIERED_421', 7)).toEqual([400, 400, 400, 200, 200, 100, 100]);
    expect(getCombinationSet('TIERED_421', 8)).toEqual([400, 400, 400, 200, 200, 200, 100, 100]);
    expect(getCombinationSet('TIERED_421', 12)).toEqual([400, 400, 400, 400, 200, 200, 200, 200, 100, 100, 100, 100]);
  });
});

describe('real-league options', () => {
  it("use each league's real odds for its N worst teams", () => {
    expect(getCombinationSet('NBA', 6)).toEqual([140, 140, 140, 125, 105, 90]);
    expect(getCombinationSet('NBA_CLASSIC', 6)).toEqual([250, 199, 156, 119, 88, 63]);
    expect(getCombinationSet('NHL', 6)).toEqual([185, 135, 115, 95, 85, 75]);
    expect(getCombinationSet('MLB', 6)).toEqual([165, 165, 165, 132, 100, 75]);
  });

  it('keep the 6th team of a 6-team lottery well above 1%', () => {
    expect(percentages(getCombinationSet('NBA', 6))).toEqual([18.9, 18.9, 18.9, 16.9, 14.2, 12.2]);
    expect(percentages(getCombinationSet('NBA_CLASSIC', 6))).toEqual([28.6, 22.7, 17.8, 13.6, 10.1, 7.2]);
    expect(percentages(getCombinationSet('NHL', 6))).toEqual([26.8, 19.6, 16.7, 13.8, 12.3, 10.9]);
    expect(percentages(getCombinationSet('MLB', 6))).toEqual([20.6, 20.6, 20.6, 16.5, 12.5, 9.4]);
  });

  it('match the real 12th seed in a 12-team lottery', () => {
    expect(getCombinationSet('NBA', 12)).toEqual([140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15]);
    expect(percentages(getCombinationSet('NHL', 12)).at(-1)).toBe(2.6);
  });

  it('defaults Custom to NBA odds', () => {
    expect(getCombinationSet('CUSTOM', 6)).toEqual(getCombinationSet('NBA', 6));
  });
});

describe('simple options', () => {
  it('Equal gives every team the same odds', () => {
    expect(new Set(getCombinationSet('EQUAL', 9)).size).toBe(1);
  });

  it('Linear steps down evenly', () => {
    expect(percentages(getCombinationSet('LINEAR', 6))).toEqual([28.6, 23.8, 19.0, 14.3, 9.5, 4.8]);
  });

  it('falls back to NBA odds for an unknown option', () => {
    expect(getCombinationSet('NOT_A_SET', 6)).toEqual(getCombinationSet('NBA', 6));
  });
});

describe('tier helper', () => {
  it('splitIntoTiers sizes tiers as evenly as possible, worst tiers first', () => {
    expect(splitIntoTiers(7, [4, 2, 1])).toEqual([4, 4, 4, 2, 2, 1, 1]);
    expect(splitIntoTiers(2, [4, 2, 1])).toEqual([4, 2]);
  });
});
