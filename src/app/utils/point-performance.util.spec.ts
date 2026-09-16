import { Employee } from '../models/employee';
import { logicalPointPerformanceDays, pointBusinessDay, pointPerformanceDays, summarizeEmployeePoints, summarizeLogicalEmployeePoints, summarizePointDays, summarizeTeamPoints } from './point-performance.util';

describe('independent expected points', () => {
  const employee = (change: Partial<Employee> = {}): Employee => ({
    uid: 'employee', status: 'Travaille', expectedPointsSince: '9-15-2026',
    dailyPoints: {'9-15-2026': '10'},
    totalDailyPoints: {'9-15-2026': '1', '9-16-2026': '0'},
    expectedPoints: {'9-15-2026': 10, '9-16-2026': 10}, ...change,
  });

  it('10/10 then a scheduled day without any submission becomes 50%, for individual and team', () => {
    expect(summarizeEmployeePoints(employee(), 9, 2026, '9-16-2026').percent).toBe(50);
    expect(summarizeTeamPoints([employee()], 9, 2026, '9-16-2026').percent).toBe(50);
  });

  it('keeps inactive assignments in the manager workload after dateLeft, without inventing old history', () => {
    const inactive = employee({ status: 'Quitté', dateLeft: '9-14-2026' });
    expect(summarizeTeamPoints([inactive], 9, 2026, '9-16-2026').percent).toBe(50);
    const missing = { ...inactive, expectedPoints: { '9-15-2026': 10 } };
    expect(summarizeTeamPoints([missing], 9, 2026, '9-16-2026').complete).toBeFalse();
    expect(summarizeTeamPoints([missing], 9, 2026, '9-16-2026').percent).toBeNull();
    const empty = employee({ status: 'Quitté', dateLeft: '9-14-2026', dailyPoints: {},
      totalDailyPoints: {}, expectedPoints: { '9-15-2026': 0, '9-16-2026': 0 } });
    expect(summarizeTeamPoints([inactive, empty], 9, 2026, '9-16-2026').percent).toBe(50);
    expect(summarizeTeamPoints([empty], 9, 2026, '9-16-2026').complete).toBeTrue();
    const legacy: Employee = { status: 'Quitté', dateLeft: '9-14-2026',
      dailyPoints: { '9-14-2026': '10' }, totalDailyPoints: { '9-14-2026': '10' } };
    expect(summarizeTeamPoints([legacy], 9, 2026, '9-16-2026').percent).toBe(100);
  });

  it('cannot be inflated by an old cached app overwriting the legacy expected map', () => {
    expect(summarizeEmployeePoints(employee({totalDailyPoints: {'9-15-2026': '0', '9-16-2026': '0'}}), 9, 2026, '9-16-2026').percent).toBe(50);
  });

  it('missing entire day, invalid capture and owner-level first-capture failure are unavailable', () => {
    expect(summarizeEmployeePoints(employee({expectedPoints: {'9-15-2026': 10}}), 9, 2026, '9-16-2026').percent).toBeNull();
    expect(summarizeEmployeePoints(employee({expectedPoints: {'9-15-2026': 10, '9-16-2026': null}}), 9, 2026, '9-16-2026').complete).toBeFalse();
    expect(summarizeEmployeePoints({dailyPoints: {'9-15-2026': '10'}, totalDailyPoints: {'9-15-2026': '10'}}, 9, 2026, '9-16-2026', '9-16-2026').percent).toBeNull();
  });

  it('zero workload is neutral, never a manufactured 100%', () => {
    expect(summarizeEmployeePoints(employee({dailyPoints: {}, expectedPoints: {'9-15-2026': 0, '9-16-2026': 0}}), 9, 2026, '9-16-2026').percent).toBeNull();
    expect(summarizeEmployeePoints(employee({expectedPoints: {'9-15-2026': 10, '9-16-2026': 0}}), 9, 2026, '9-16-2026').percent).toBe(100);
  });

  it('excludes future forecasts and skips Sunday capture gaps', () => {
    const data = employee({expectedPointsSince: '9-19-2026', totalDailyPoints: {}, expectedPoints: {'9-19-2026': 10, '9-21-2026': 10}, dailyPoints: {'9-19-2026': '10'}});
    expect(summarizeEmployeePoints(data, 9, 2026, '9-20-2026').percent).toBe(100);
    expect(summarizeEmployeePoints(data, 9, 2026, '9-21-2026').percent).toBe(50);
    expect(pointBusinessDay(new Date('2026-09-15T23:01:00Z'))).toBe('9-16-2026');
  });

  it('retains earlier recorded history but never retroactively guesses absent days', () => {
    const data = employee({dailyPoints: {'9-14-2026': '5', '9-15-2026': '10'}, totalDailyPoints: {'9-14-2026': '10'}});
    expect(summarizeEmployeePoints(data, 9, 2026, '9-16-2026').percent).toBe(50);
  });

  it('keeps deliberate overpayment extra points without changing policy', () => {
    expect(summarizeEmployeePoints(employee({dailyPoints: {'9-15-2026': '20'}}), 9, 2026, '9-16-2026').percent).toBe(100);
  });

  it('new site-specific workloads are additive; a zero source/rotation cannot hide expected duties', () => {
    const source = employee();
    const copy = employee({expectedPoints: {'9-15-2026': 0, '9-16-2026': 0}});
    expect(summarizePointDays(logicalPointPerformanceDays([copy, source], '9-16-2026')).percent).toBe(50);
    const secondSite = employee({dailyPoints: {}, expectedPoints: {'9-15-2026': 10, '9-16-2026': 10}});
    expect(summarizePointDays(logicalPointPerformanceDays([source, secondSite], '9-16-2026')).percent).toBe(25);
  });

  it('does not mutate records and handles expected-only days in legacy data', () => {
    const data: Employee = {dailyPoints: {'9-15-2026': '10'}, totalDailyPoints: {'9-15-2026': '10', '9-16-2026': '10'}};
    const before = JSON.stringify(data);
    expect(summarizeEmployeePoints(data, 9, 2026, '9-16-2026').percent).toBe(50);
    pointPerformanceDays(data, '9-16-2026');
    expect(JSON.stringify(data)).toBe(before);
  });

  it('monthly calculation bounds old gap generation without hiding a missing selected-month day', () => {
    const data = employee({ expectedPointsSince: '1-1-2020' });
    // Missing old months do not invalidate a completely captured month.
    const selected = employee({ expectedPointsSince: '1-1-2020', expectedPoints: {
      '9-1-2026': 10, '9-2-2026': 10,
    }, dailyPoints: { '9-1-2026': '10' } });
    expect(summarizeEmployeePoints(selected, 9, 2026, '9-2-2026').percent).toBe(50);
    expect(summarizeLogicalEmployeePoints([selected], 9, 2026, '9-2-2026').percent).toBe(50);
    expect(pointPerformanceDays(data, '9-16-2026', undefined, '9-15-2026').length).toBe(2);
    expect(summarizeEmployeePoints(selected, 9, 2026, '9-3-2026').complete).toBeFalse();
    expect(summarizeEmployeePoints(selected, 10, 2026, '9-2-2026').percent).toBeNull();
  });
});
