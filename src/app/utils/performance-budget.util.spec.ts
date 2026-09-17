import { normalizePerformanceBudgetProportion, scalePerformanceBudget } from './performance-budget.util';

describe('performance budget proportion', () => {
  it('defaults missing or invalid configuration to half', () => {
    for (const value of [undefined, null, '', ' ', NaN, Infinity, -1, 101, 'bad']) {
      expect(normalizePerformanceBudgetProportion(value)).toBe(50);
    }
  });

  it('scales every tier, including fractional millions, zero and the original full rate', () => {
    expect(scalePerformanceBudget(6000000, 50)).toBe(3000000);
    expect(scalePerformanceBudget(9000000, 50)).toBe(4500000);
    expect(scalePerformanceBudget(1000000, 50)).toBe(500000);
    expect(scalePerformanceBudget(10000000, 50)).toBe(5000000);
    expect(scalePerformanceBudget(6000000, 25)).toBe(1500000);
    expect(scalePerformanceBudget(6000000, 0)).toBe(0);
    expect(scalePerformanceBudget(6000000, 100)).toBe(6000000);
  });
});
