import { describe, expect, it } from 'vitest';
import { LOTTERY } from '../constants';
import { calculateTotalCombinations, getCombinationSet, scaleCurve, splitIntoTiers, tieWorst } from './combinations';

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
      'HALVING',
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
  it('NBA ties the worst quarter of teams, like the NBA ties its worst three', () => {
    const six = getCombinationSet('NBA', 6);
    expect(six[0]).toBe(six[1]);
    expect(six[2]).toBeLessThan(six[1]);
    const twelve = getCombinationSet('NBA', 12);
    expect(twelve.slice(0, 3)).toEqual([twelve[0], twelve[0], twelve[0]]);
    expect(twelve[3]).toBeLessThan(twelve[2]);
    expect(percentages(six)).toEqual([32.0, 32.0, 19.9, 11.0, 4.1, 1.1]);
  });

  it('NBA Classic, NHL, and MLB follow their leagues\' curves', () => {
    expect(percentages(getCombinationSet('NBA_CLASSIC', 6))).toEqual([52.7, 28.2, 12.4, 4.0, 1.6, 1.1]);
    expect(percentages(getCombinationSet('NHL', 6))).toEqual([45.7, 23.5, 16.0, 8.6, 4.9, 1.2]);
    const mlb = getCombinationSet('MLB', 12);
    expect(mlb.slice(0, 3)).toEqual([mlb[0], mlb[0], mlb[0]]);
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

  it('Halving gives each team half the odds of the team above, never zero', () => {
    expect(percentages(getCombinationSet('HALVING', 6))).toEqual([50.8, 25.4, 12.7, 6.3, 3.2, 1.6]);
    expect(Math.min(...getCombinationSet('HALVING', 12))).toBeGreaterThanOrEqual(1);
  });

  it('falls back to NBA odds for an unknown option', () => {
    expect(getCombinationSet('NOT_A_SET', 6)).toEqual(getCombinationSet('NBA', 6));
  });
});

describe('curve helpers', () => {
  it('scaleCurve keeps a curve unchanged at its own length and keeps its endpoints at any length', () => {
    const curve = [10, 8, 5, 1];
    expect(scaleCurve(curve, 4)).toEqual(curve);
    const stretched = scaleCurve(curve, 7);
    expect(stretched[0]).toBe(10);
    expect(stretched[6]).toBe(1);
    expect(scaleCurve(curve, 1)).toEqual([10]);
  });

  it('tieWorst raises the worst teams to the top value', () => {
    expect(tieWorst([10, 8, 5, 1], 2)).toEqual([10, 10, 5, 1]);
  });

  it('splitIntoTiers sizes tiers as evenly as possible, worst tiers first', () => {
    expect(splitIntoTiers(7, [4, 2, 1])).toEqual([4, 4, 4, 2, 2, 1, 1]);
    expect(splitIntoTiers(2, [4, 2, 1])).toEqual([4, 2]);
  });
});
