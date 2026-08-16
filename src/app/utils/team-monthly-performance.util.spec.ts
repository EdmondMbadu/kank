import { Employee } from '../models/employee';
import { buildTeamMonthlyPerformanceSeries } from './team-monthly-performance.util';

describe('buildTeamMonthlyPerformanceSeries', () => {
  it('matches the manager formula across every employee in the team', () => {
    const employees: Employee[] = [
      Object.assign(new Employee(), {
        dailyPoints: {
          '8-1-2026': '6',
          '8-2-2026': '8',
        },
        totalDailyPoints: {
          '8-1-2026': '10',
          '8-2-2026': '10',
        },
      }),
      Object.assign(new Employee(), {
        dailyPoints: {
          '8-1-2026': '7',
          '8-2-2026': '9',
        },
        totalDailyPoints: {
          '8-1-2026': '10',
          '8-2-2026': '10',
        },
      }),
    ];

    expect(buildTeamMonthlyPerformanceSeries(employees)).toEqual([
      {
        key: '8-2026',
        achieved: 30,
        total: 40,
        percent: 75,
      },
    ]);
  });

  it('sorts months chronologically instead of by their text key', () => {
    const employee = Object.assign(new Employee(), {
      dailyPoints: {
        '11-1-2025': '5',
        '2-1-2026': '8',
        '1-1-2026': '6',
      },
      totalDailyPoints: {
        '11-1-2025': '10',
        '2-1-2026': '10',
        '1-1-2026': '10',
      },
    });

    expect(
      buildTeamMonthlyPerformanceSeries([employee]).map((point) => point.key)
    ).toEqual(['11-2025', '1-2026', '2-2026']);
  });

  it('uses the same tolerant numeric parsing as the manager page', () => {
    const employee = Object.assign(new Employee(), {
      dailyPoints: {
        '8-1-2026': ' 1,200 ',
        'invalid': '999',
        '8-2-2026': 'not-a-number',
      },
      totalDailyPoints: {
        '8-1-2026': '2,000',
        '8-2-2026': '500',
      },
    });

    expect(buildTeamMonthlyPerformanceSeries([employee])).toEqual([
      {
        key: '8-2026',
        achieved: 1200,
        total: 2500,
        percent: 48,
      },
    ]);
  });

  it('returns a safe zero when a month has no possible points', () => {
    const employee = Object.assign(new Employee(), {
      dailyPoints: { '8-1-2026': '5' },
      totalDailyPoints: {},
    });

    expect(buildTeamMonthlyPerformanceSeries([employee])[0].percent).toBe(0);
  });
});
