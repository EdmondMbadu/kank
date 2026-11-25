import { Employee } from '../../models/employee';
import { AmountPerformanceDayRecord } from '../../utils/amount-performance.util';
import { logicalPointPerformanceDays, pointDayTime } from '../../utils/point-performance.util';

export interface PlacementValue {
  score: number | null;
  count?: number;
  complete: boolean;
}
export interface PlacementParticipant {
  key: string;
  days: ReadonlyMap<string, PlacementValue>;
}
export interface PlacementSummary {
  ranks: Array<{ rank: number; days: number }>;
  days: number;
  topThree: number;
  other: number;
  unranked: number;
  incomplete: number;
}
export interface RankingDetailsView {
  name: string;
  location: string;
  metric: string;
  period: string;
  loading: boolean;
  loadingLabel?: string;
  error?: boolean;
  message: string;
  summary: PlacementSummary | null;
}

export function placementDay(raw: string): string | null {
  const time = pointDayTime(raw.split('-').slice(0, 3).join('-'));
  if (time === null) return null;
  const date = new Date(time);
  return `${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCFullYear()}`;
}

/** One local pass for everyone. Exact ties share competition ranks (1, 1, 3).
 * Missing contenders invalidate the day instead of manufacturing a winner. */
export function summarizePlacements(
  participants: PlacementParticipant[], dayKeys: readonly string[], today: string
): Map<string, PlacementSummary> {
  const results = new Map<string, PlacementSummary>();
  const counts = new Map<string, Map<number, number>>();
  for (const person of participants) {
    results.set(person.key, { ranks: [], days: 0, topThree: 0, other: 0, unranked: 0, incomplete: 0 });
    counts.set(person.key, new Map());
  }
  const cutoff = pointDayTime(today);
  if (cutoff === null) return results;
  for (const day of new Set(dayKeys)) {
    const time = pointDayTime(day);
    if (time === null || time >= cutoff) continue;
    const values = participants.map((person) => ({ key: person.key, value: person.days.get(day) }));
    if (values.some(({ value }) => !value?.complete ||
        (value.score !== null && !Number.isFinite(value.score)) ||
        !Number.isFinite(value.count ?? 0))) {
      results.forEach((summary) => summary.incomplete++);
      continue;
    }
    const ranked = values.filter(({ value }) => value!.score !== null && value!.score! > 0)
      .sort((a, b) => b.value!.score! - a.value!.score! || (b.value!.count || 0) - (a.value!.count || 0));
    if (!ranked.length) continue;
    const rankedKeys = new Set(ranked.map((row) => row.key));
    results.forEach((summary, key) => { if (!rankedKeys.has(key)) summary.unranked++; });
    let rank = 1;
    ranked.forEach((row, index) => {
      const previous = ranked[index - 1];
      if (index && (row.value!.score !== previous.value!.score ||
          (row.value!.count || 0) !== (previous.value!.count || 0))) rank = index + 1;
      const summary = results.get(row.key)!;
      const distribution = counts.get(row.key)!;
      distribution.set(rank, (distribution.get(rank) || 0) + 1);
      summary.days++;
      if (rank <= 3) summary.topThree++; else summary.other++;
    });
  }
  results.forEach((summary, key) => {
    summary.ranks = [...counts.get(key)!].sort(([a], [b]) => a - b)
      .map(([rank, days]) => ({ rank, days }));
  });
  return results;
}

/** Groups are logical people; managers receive the sum of their site's people.
 * Use the same ordered source/rotation records as the monthly calculation. */
export function habitualPlacementDays(
  groups: Employee[][], month: number, year: number, today: string,
  cache = new Map<Employee[], ReturnType<typeof logicalPointPerformanceDays>>()
): Map<string, PlacementValue> {
  const todayTime = pointDayTime(today);
  if (todayTime === null || !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(year) || year < 1900) return new Map();
  // Never expand expected-day history beyond the selected month on a phone.
  const cutoff = new Date(Math.min(todayTime, Date.UTC(year, month, 0)));
  const throughDay = `${cutoff.getUTCMonth() + 1}-${cutoff.getUTCDate()}-${cutoff.getUTCFullYear()}`;
  const byDay = new Map<string, { earned: number; possible: number; complete: boolean; contributors: number }>();
  for (const group of groups) {
    let days = cache.get(group);
    if (!days) {
      days = logicalPointPerformanceDays(group, throughDay, `${month}-1-${year}`);
      cache.set(group, days);
    }
    for (const day of days) {
      const key = placementDay(day.key);
      if (!key || !key.startsWith(`${month}-`) || !key.endsWith(`-${year}`)) continue;
      const row = byDay.get(key) || { earned: 0, possible: 0, complete: true, contributors: 0 };
      row.earned += day.possible !== null && day.possible > 0 ? day.earned : 0;
      row.possible += day.possible || 0;
      row.complete &&= day.possible !== null;
      row.contributors++;
      byDay.set(key, row);
    }
  }
  return new Map([...byDay].map(([key, row]) => [key, {
    score: row.possible > 0 ? Math.floor(row.earned / row.possible * 100) : null,
    complete: row.complete && row.contributors === groups.length,
  }]));
}

export function amountPlacementDays(
  records: AmountPerformanceDayRecord[], month: number, year: number,
  collected?: Record<string, string>
): Map<string, PlacementValue> {
  const byDay = new Map<string, { expected: number; total: number; complete: boolean }>();
  for (const record of records) {
    const key = placementDay(record.dayKey);
    if (!key || !key.startsWith(`${month}-`) || !key.endsWith(`-${year}`)) continue;
    const row = byDay.get(key) || { expected: 0, total: 0, complete: true };
    row.expected += Math.max(0, record.expected);
    row.total += Math.max(0, record.total);
    row.complete &&= Number.isFinite(record.expected) && record.expected >= 0 &&
      Number.isFinite(record.total) && (record.expectedPresent || record.total <= 0);
    byDay.set(key, row);
  }
  if (collected) {
    byDay.forEach((row) => row.total = 0);
    Object.entries(collected).forEach(([rawKey, value]) => {
      const key = placementDay(rawKey);
      if (!key || !key.startsWith(`${month}-`) || !key.endsWith(`-${year}`)) return;
      const row = byDay.get(key) || { expected: 0, total: 0, complete: false };
      row.total += Math.max(0, Number(value));
      byDay.set(key, row);
    });
  }
  return new Map([...byDay].map(([key, row]) => [key, {
    score: row.expected > 0 ? row.total / row.expected * 100 : null,
    complete: row.complete && Number.isFinite(row.total) && (row.expected > 0 || row.total === 0),
  }]));
}
