import { amountPlacementDays, habitualPlacementDays, PlacementParticipant, summarizePlacements } from './ranking-placement.util';

describe('ranking placement history', () => {
  const day = '7-20-2026';
  const person = (key: string, score: number | null, count = 0): PlacementParticipant => ({
    key, days: new Map([[day, { score, count, complete: true }]]),
  });

  it('shares exact ties, uses payment count to break amount ties and keeps every later place', () => {
    const rows = [person('a', 100, 2), person('b', 100, 2), person('c', 100, 1),
      person('d', 50), person('e', 0), person('f', null)];
    const result = summarizePlacements(rows, [day, day], '7-23-2026');
    expect(result.get('a')!.ranks).toEqual([{ rank: 1, days: 1 }]);
    expect(result.get('b')!.ranks).toEqual([{ rank: 1, days: 1 }]);
    expect(result.get('c')!.ranks).toEqual([{ rank: 3, days: 1 }]);
    expect(result.get('d')!.ranks).toEqual([{ rank: 4, days: 1 }]);
    expect(result.get('d')!.other).toBe(1);
    expect(result.get('e')!.days).toBe(0);
    expect(result.get('e')!.unranked).toBe(1);
    expect(rows[0].days.get(day)!.score).toBe(100);
  });

  it('excludes today, future dates and an entire day with an unknown contender', () => {
    const a = person('a', 100), b = person('b', 50);
    (a.days as Map<string, any>).set('7-23-2026', { score: 100, complete: true });
    (b.days as Map<string, any>).set('7-23-2026', { score: 50, complete: true });
    (b.days as Map<string, any>).set(day, { score: null, complete: false });
    const result = summarizePlacements([a, b], [day, '7-23-2026', '7-24-2026', 'invalid'], '7-23-2026');
    expect(result.get('a')!.days).toBe(0);
    expect(result.get('a')!.incomplete).toBe(1);
    expect(summarizePlacements([a], [day], 'invalid').get('a')!.days).toBe(0);
  });

  it('does not call a zero-activity day a win, and rejects missing/non-finite values', () => {
    expect(summarizePlacements([person('a', 0)], [day], '7-23-2026').get('a')!.days).toBe(0);
    for (const other of [person('b', NaN), { key: 'b', days: new Map() }]) {
      const result = summarizePlacements([person('a', 100), other], [day], '7-23-2026');
      expect(result.get('a')!.topThree).toBe(0);
      expect(result.get('a')!.incomplete).toBe(1);
    }
  });

  it('deduplicates legacy copies and adds independent rotation expectations before computing a day', () => {
    const legacy = { dailyPoints: { [day]: '8' }, totalDailyPoints: { [day]: '10' } };
    const rows = habitualPlacementDays([[legacy, legacy]], 7, 2026, '7-23-2026');
    expect(rows.get(day)!.score).toBe(80);
    const independent = habitualPlacementDays([[
      { dailyPoints: { [day]: '8' }, expectedPoints: { [day]: 10 } },
      { dailyPoints: { [day]: '2' }, expectedPoints: { [day]: 5 } },
    ]], 7, 2026, '7-23-2026');
    expect(independent.get(day)!.score).toBe(66);
    expect(independent.get(day)!.complete).toBeTrue();
  });

  it('sums logical people for a manager and excludes incomplete team expectations', () => {
    const groups = [
      [{ dailyPoints: { [day]: '8' }, expectedPoints: { [day]: 10 } }],
      [{ dailyPoints: { [day]: '2' }, expectedPoints: { [day]: 5 } }],
    ];
    expect(habitualPlacementDays(groups, 7, 2026, '7-23-2026').get(day)!.score).toBe(66);
    const incomplete = habitualPlacementDays([
      groups[0], [{ dailyPoints: { [day]: '3' }, expectedPoints: { [day]: null } }],
    ], 7, 2026, '7-23-2026');
    expect(incomplete.get(day)!.complete).toBeFalse();
  });

  it('bounds expected-day expansion to the selected month when viewing older history', () => {
    const group = [{ expectedPointsSince: '1-1-2023', expectedPoints: { [day]: 10 }, dailyPoints: { [day]: '8' } }];
    const cache = new Map();
    habitualPlacementDays([group], 7, 2026, '11-25-2026', cache);
    expect(cache.get(group).length).toBeLessThanOrEqual(31);
    expect(cache.get(group).every((row: { key: string }) => row.key.startsWith('7-'))).toBeTrue();
  });

  it('uses site collections for amount performance and does not fabricate missing expectations', () => {
    const records = [{ dayKey: day, expected: 200, total: 100, expectedPresent: true, totalPresent: true }];
    expect(amountPlacementDays(records, 7, 2026).get(day)!.score).toBe(50);
    expect(amountPlacementDays(records, 7, 2026, { [day]: '180' }).get(day)!.score).toBe(90);
    const missing = amountPlacementDays([{ ...records[0], expectedPresent: false }], 7, 2026);
    expect(missing.get(day)!.complete).toBeFalse();
    expect(amountPlacementDays(records, 8, 2026).size).toBe(0);
    expect(amountPlacementDays(records, 7, 2026, { '7-21-2026': '50' }).get('7-21-2026')!.complete).toBeFalse();
  });
});
