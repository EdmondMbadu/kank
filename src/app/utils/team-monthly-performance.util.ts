import { Employee } from '../models/employee';

export interface TeamMonthlyPerformancePoint {
  /** Existing application month key format: M-YYYY. */
  key: string;
  achieved: number;
  total: number;
  percent: number;
}

type PerformanceEmployee = Pick<Employee, 'dailyPoints' | 'totalDailyPoints'>;

function performanceNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[\s,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

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
  employees: readonly PerformanceEmployee[]
): TeamMonthlyPerformancePoint[] {
  const months = new Map<string, { achieved: number; total: number }>();

  for (const employee of employees || []) {
    const dailyPoints = employee?.dailyPoints;
    if (!dailyPoints) continue;

    for (const [rawDate, rawAchieved] of Object.entries(dailyPoints)) {
      const dateParts = rawDate.split('-');
      if (dateParts.length < 3) continue;

      const month = dateParts[0];
      const year = dateParts[2];
      if (!month || !year) continue;

      const key = `${month}-${year}`;
      const previous = months.get(key) ?? { achieved: 0, total: 0 };
      months.set(key, {
        achieved: previous.achieved + performanceNumber(rawAchieved),
        total:
          previous.total +
          performanceNumber(employee.totalDailyPoints?.[rawDate]),
      });
    }
  }

  return Array.from(months.entries())
    .map(([key, values]) => ({
      key,
      achieved: values.achieved,
      total: values.total,
      percent: values.total > 0 ? (values.achieved / values.total) * 100 : 0,
    }))
    .sort((a, b) => monthTime(a.key) - monthTime(b.key));
}
