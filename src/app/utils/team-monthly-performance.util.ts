import { PointPerformanceEmployee, pointBusinessDay, pointPerformanceDays, summarizePointDays, PointPerformanceDay } from './point-performance.util';

export interface TeamMonthlyPerformancePoint {
  /** Existing application month key format: M-YYYY. */
  key: string;
  achieved: number;
  total: number;
  percent: number;
}

type PerformanceEmployee = PointPerformanceEmployee;

function monthTime(key: string): number {
  const [month, year] = key.split('-').map(Number);
  return new Date(year || 0, (month || 1) - 1, 1).getTime();
}

/**
 * Produces the same monthly percentage used by a Manager employee page:
 * the sum of every team member's achieved points divided by the sum of
 * every team member's possible points for that month.
 */
export function buildTeamMonthlyPerformanceSeries(
  employees: readonly PerformanceEmployee[],
  throughDay = pointBusinessDay(), ownerSince?: string
): TeamMonthlyPerformancePoint[] {
  const months = new Map<string, PointPerformanceDay[]>();

  for (const employee of employees || []) {
    for (const day of pointPerformanceDays(employee, throughDay, ownerSince)) {
      const [month, , year] = day.key.split('-').map(Number);
      const key = `${month}-${year}`;
      const previous = months.get(key) ?? [];
      previous.push(day);
      months.set(key, previous);
    }
  }

  return Array.from(months.entries())
    .map(([key, days]) => ({key, summary: summarizePointDays(days)}))
    // Do not graph an incomplete month as a misleading 100% (or a false zero).
    .filter(({summary}) => summary.complete)
    .map(({key, summary}) => ({
      key,
      achieved: summary.earned,
      total: summary.possible,
      percent: summary.percent ?? 0,
    }))
    .sort((a, b) => monthTime(a.key) - monthTime(b.key));
}
