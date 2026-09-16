import { Employee } from '../models/employee';

export type PointPerformanceEmployee = Pick<
  Employee,
  'dailyPoints' | 'totalDailyPoints' | 'expectedPoints' | 'expectedPointsSince' |
  'tempUser' | 'status' | 'dateLeft'
>;

export interface PointPerformanceDay {
  key: string;
  earned: number;
  possible: number | null;
  independent: boolean;
  earnedPresent?: boolean;
}

export interface PointPerformanceSummary {
  earned: number;
  possible: number;
  complete: boolean;
  percent: number | null;
}

const DAY_MS = 86400000;

/** Calendar date represented as UTC solely for timezone-safe day arithmetic. */
export function pointDayTime(value: string): number | null {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value || '');
  if (!match) return null;
  const [, month, day, year] = match.map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day ? ms : null;
}

export function pointBusinessDay(now = new Date()): string {
  const date = new Date(now.getTime() + 3600000); // Africa/Kinshasa, UTC+1
  return `${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCFullYear()}`;
}

function dayKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCFullYear()}`;
}

function points(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(String(value).replace(/[\s,]/g, ''));
  return Number.isFinite(number) ? number : null;
}

/** No reads or mutations. Independent expectations ALWAYS win over old writes. */
export function pointPerformanceDays(
  employee: PointPerformanceEmployee,
  throughDay = pointBusinessDay(),
  ownerSince?: string,
  fromDay?: string
): PointPerformanceDay[] {
  const cutoff = pointDayTime(throughDay);
  if (cutoff === null) return [];
  const lowerBound = fromDay ? pointDayTime(fromDay) : null;
  const start = pointDayTime(employee.expectedPointsSince || ownerSince ||
    employee.tempUser?.pointExpectationSince || '');
  const dates = new Set([
    ...Object.keys(employee.dailyPoints || {}),
    ...Object.keys(employee.totalDailyPoints || {}),
    ...Object.keys(employee.expectedPoints || {}),
  ]);
  if (start !== null && start <= cutoff) {
    // The daily job publishes every assignment bucket, including inactive
    // employees (zero when no eligible clients remain). Do not hide a missed
    // inactive bucket behind dateLeft: the manager still owns those clients.
    // Without activation, legacy departed history is left untouched.
    for (let ms = Math.max(start, lowerBound ?? start); ms <= cutoff; ms += DAY_MS) {
      if (new Date(ms).getUTCDay() !== 0) dates.add(dayKey(ms));
    }
  }
  const result: PointPerformanceDay[] = [];
  for (const key of dates) {
    const time = pointDayTime(key);
    if (time === null || time > cutoff || (lowerBound !== null && time < lowerBound)) continue;
    const independent = Object.prototype.hasOwnProperty.call(employee.expectedPoints || {}, key) ||
      (start !== null && time >= start);
    const sunday = new Date(time).getUTCDay() === 0;
    const captured = Object.prototype.hasOwnProperty.call(employee.expectedPoints || {}, key);
    const raw = independent ? (captured ? employee.expectedPoints?.[key] : sunday ? 0 : undefined) : employee.totalDailyPoints?.[key];
    const possible = points(raw);
    result.push({key, earned: points(employee.dailyPoints?.[key]) ?? 0,
      possible: possible !== null && possible >= 0 ? possible : null, independent,
      earnedPresent: points(employee.dailyPoints?.[key]) !== null});
  }
  return result.sort((a, b) => pointDayTime(a.key)! - pointDayTime(b.key)!);
}

/** Legacy copied history is deduped. New location-specific workloads are not
 * copied by the transfer workflow and are additive when one person has duties
 * at two sites. A zero-workload source copy cannot hide a positive expectation.
 * records must be ordered with the application's representative priority. */
export function logicalPointPerformanceDays(
  records: readonly PointPerformanceEmployee[], throughDay = pointBusinessDay(),
  fromDay?: string
): PointPerformanceDay[] {
  const byDate = new Map<string, PointPerformanceDay[]>();
  for (const record of records) {
    for (const day of pointPerformanceDays(record, throughDay, undefined, fromDay)) {
      const group = byDate.get(day.key) || [];
      group.push(day);
      byDate.set(day.key, group);
    }
  }
  return Array.from(byDate.entries()).map(([key, group]) => {
    const independent = group.filter((day) => day.independent);
    if (!independent.length) {
      const possible = group.find((day) => day.possible !== null)?.possible ?? null;
      const earned = group.find((day) => day.earnedPresent)?.earned ?? 0;
      return {key, possible, earned, independent: false};
    }
    const valid = independent.filter((day) => day.possible !== null);
    const possible = valid.reduce((sum, day) => sum + day.possible!, 0);
    // A missed active-site capture must not disappear behind a source record.
    const complete = independent.every((day) => day.possible !== null);
    const positive = valid.filter((day) => day.possible! > 0);
    const earned = positive.length ? positive.reduce((sum, day) => sum + day.earned, 0) : group[0].earned;
    return {key, earned, possible: complete ? possible : null, independent: true};
  });
}

export function summarizePointDays(days: readonly PointPerformanceDay[]): PointPerformanceSummary {
  let earned = 0;
  let possible = 0;
  let complete = true;
  for (const day of days) {
    if (day.possible === null) {
      // Missing old history remains legacy; newly missing capture is NOT zero.
      if (day.independent) complete = false;
      continue;
    }
    earned += day.earned;
    possible += day.possible;
  }
  return {earned, possible, complete,
    percent: complete && possible > 0 ? earned * 100 / possible : null};
}

export function summarizeEmployeePoints(
  employee: PointPerformanceEmployee, month?: number, year?: number,
  throughDay = pointBusinessDay(), ownerSince?: string
): PointPerformanceSummary {
  const window = pointMonthWindow(month, year, throughDay);
  return summarizePointDays(pointPerformanceDays(employee, window.throughDay, ownerSince, window.fromDay).filter((day) => {
    const [m, , y] = day.key.split('-').map(Number);
    return (month === undefined || m === month) && (year === undefined || y === year);
  }));
}

function pointMonthWindow(month: number | undefined, year: number | undefined, throughDay: string):
  { fromDay?: string; throughDay: string } {
  if (month === undefined || year === undefined || month < 1 || month > 12) return { throughDay };
  const last = Date.UTC(year, month, 0);
  const cutoff = pointDayTime(throughDay);
  return { fromDay: `${month}-1-${year}`,
    throughDay: cutoff === null ? throughDay : dayKey(Math.min(last, cutoff)) };
}

/** Bound monthly gap generation to one month, even after years of captures. */
export function summarizeLogicalEmployeePoints(
  records: readonly PointPerformanceEmployee[], month: number, year: number,
  throughDay = pointBusinessDay()
): PointPerformanceSummary {
  const window = pointMonthWindow(month, year, throughDay);
  return summarizePointDays(logicalPointPerformanceDays(records, window.throughDay, window.fromDay).filter((day) => {
    const [m, , y] = day.key.split('-').map(Number);
    return m === month && y === year;
  }));
}

export function summarizeTeamPoints(
  employees: readonly PointPerformanceEmployee[], month?: number, year?: number,
  throughDay = pointBusinessDay(), ownerSince?: string
): PointPerformanceSummary {
  const summaries = employees.map((employee) => summarizeEmployeePoints(employee, month, year, throughDay, ownerSince));
  const earned = summaries.reduce((sum, value) => sum + value.earned, 0);
  const possible = summaries.reduce((sum, value) => sum + value.possible, 0);
  const complete = summaries.every((value) => value.complete);
  return {earned, possible, complete, percent: complete && possible > 0 ? earned * 100 / possible : null};
}
