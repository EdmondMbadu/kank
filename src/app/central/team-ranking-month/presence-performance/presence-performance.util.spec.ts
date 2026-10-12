import { buildPresencePerformanceRows, presenceCorrelation, presenceCorrelationsByScope, PresencePerformanceSource } from './presence-performance.util';

describe('Presence and performance comparison', () => {
  const weekdays = ['10-1-2026', '10-2-2026', '10-5-2026', '10-6-2026', '10-7-2026', '10-8-2026'];
  function source(overrides: Partial<PresencePerformanceSource> = {}): PresencePerformanceSource {
    return { month: 10, year: 2026, throughDay: '10-8-2026', periodLabel: 'Octobre 2026',
      exceptionsReady: true, performanceReady: true, excludedDates: [],
      employees: [{ id: 'a', name: 'Alice', role: 'Agent', location: 'Site A', records: [{
        attendance: Object.fromEntries(weekdays.map((key) => [key, 'P'])),
        dailyPoints: Object.fromEntries(weekdays.map((key) => [key, '5'])),
        expectedPoints: Object.fromEntries(weekdays.map((key) => [key, 10])),
      }] }], isEmployed: () => true, normalizeStatus: (raw) => String(raw || '').trim().toUpperCase(), ...overrides };
  }

  it('aligns both measures to elapsed Monday–Friday dates, excluding weekends and future dates', () => {
    const input = source();
    const record = input.employees[0].records[0];
    record.attendance!['10-3-2026'] = 'P'; record.attendance!['10-9-2026'] = 'A';
    record.expectedPoints!['10-3-2026'] = 1000; record.dailyPoints!['10-3-2026'] = '1000';
    record.expectedPoints!['10-9-2026'] = 1000; record.dailyPoints!['10-9-2026'] = '0';
    const row = buildPresencePerformanceRows(input)[0];
    expect(row.days).toBe(6); expect(row.attendance).toBe(100); expect(row.performance).toBe(50); expect(row.complete).toBeTrue();
  });

  it('uses the latest timestamp, counts late attendance, and excludes leave and closures from both measures', () => {
    const input = source({ excludedDates: ['2026-10-08'] });
    const record = input.employees[0].records[0];
    record.attendance!['10-1-2026-8-0-0'] = 'A'; record.attendance!['10-1-2026-9-30-0'] = 'L';
    record.attendance!['10-2-2026'] = 'V'; record.dailyPoints!['10-2-2026'] = '1000';
    const row = buildPresencePerformanceRows(input)[0];
    expect(row.days).toBe(5); expect(row.expected).toBe(4); expect(row.present).toBe(3); expect(row.late).toBe(1);
    expect(row.leave).toBe(1); expect(row.absent).toBe(0); expect(row.attendance).toBe(100); expect(row.performance).toBe(50);
  });

  it('respects employment dates', () => {
    const row = buildPresencePerformanceRows(source({ isEmployed: (_employee, key) => Number(key.split('-')[1]) >= 5 }))[0];
    expect(row.days).toBe(4); expect(row.expected).toBe(4); expect(row.performance).toBe(50);
  });

  it('keeps missing and anomaly attendance distinct from confirmed absences and excludes them from correlation', () => {
    const input = source(); const record = input.employees[0].records[0];
    delete record.attendance!['10-1-2026']; record.attendance!['10-2-2026'] = 'F'; record.attendance!['10-5-2026'] = 'A';
    const row = buildPresencePerformanceRows(input)[0];
    expect(row.missing).toBe(1); expect(row.other).toBe(1); expect(row.absent).toBe(1);
    expect(row.attendance).toBe(50); expect(row.complete).toBeFalse(); expect(presenceCorrelation([row]).n).toBe(0);
  });

  it('distinguishes genuine zero performance from missing expectations', () => {
    const input = source(); const record = input.employees[0].records[0];
    record.dailyPoints = {};
    expect(buildPresencePerformanceRows(input)[0].performance).toBe(0);
    delete record.expectedPoints!['10-1-2026'];
    const partial = buildPresencePerformanceRows(input)[0];
    expect(partial.performance).toBe(0); expect(partial.performanceDays).toBe(5);
    expect(partial.performanceComplete).toBeFalse(); expect(partial.complete).toBeFalse();
    record.expectedPoints = {};
    expect(buildPresencePerformanceRows(input)[0].performance).toBeNull();
  });

  it('does not hide a missing independent capture behind a valid copy', () => {
    const input = source(); const record = input.employees[0].records[0];
    const copy = { ...record, expectedPointsSince: '10-1-2026', expectedPoints: { ...record.expectedPoints } };
    delete copy.expectedPoints['10-1-2026'];
    input.employees = [{ ...input.employees[0], records: [record, copy] }];
    const row = buildPresencePerformanceRows(input)[0];
    expect(row.performance).toBe(50); expect(row.performanceDays).toBe(5);
    expect(row.performanceComplete).toBeFalse(); expect(row.complete).toBeFalse();
    expect(presenceCorrelation([row]).n).toBe(0);
  });

  it('retains September employees with gaps in legacy expectations, counting only paired days', () => {
    const dates = Array.from({ length: 30 }, (_, index) => index + 1)
      .filter((day) => ![0, 6].includes(new Date(Date.UTC(2026, 8, day)).getUTCDay()))
      .map((day) => `9-${day}-2026`);
    const records = [0, 1, 2].map((index) => ({
      attendance: Object.fromEntries(dates.map((day) => [day, 'P'])),
      dailyPoints: Object.fromEntries(dates.map((day) => [day, '5'])),
      totalDailyPoints: Object.fromEntries(dates.slice(index).map((day) => [day, '10'])),
    }));
    // An earned value without an expectation must not inflate the partial ratio.
    records[1].dailyPoints[dates[0]] = '900';
    const input = source({ month: 9, throughDay: '10-8-2026', employees: records.map((record, index) => ({
      id: String(index), name: `Employee ${index}`, role: 'Agent', location: 'Site A', records: [record],
    })) });
    const rows = buildPresencePerformanceRows(input);
    expect(rows.length).toBe(3);
    expect(rows.map((row) => row.performance)).toEqual([50, 50, 50]);
    expect(rows.map((row) => row.expected)).toEqual([22, 22, 22]);
    expect(rows.map((row) => row.performanceDays)).toEqual([22, 21, 20]);
    expect(rows.map((row) => row.complete)).toEqual([true, false, false]);
    expect(presenceCorrelation(rows).n).toBe(1);
  });

  it('does not duplicate a person’s copied legacy history during a rotation', () => {
    const input = source(); const record = input.employees[0].records[0];
    record.totalDailyPoints = Object.fromEntries(weekdays.map((key) => [key, '10'])); delete record.expectedPoints;
    input.employees = [{ ...input.employees[0], records: [record, { ...record }] }];
    const rows = buildPresencePerformanceRows(input);
    expect(rows.length).toBe(1); expect(rows[0].days).toBe(6); expect(rows[0].performance).toBe(50);
  });

  it('uses the manager’s own attendance and weighted team points rather than the manager’s personal score', () => {
    const input = source();
    const record = input.employees[0].records[0];
    const colleague = { dailyPoints: Object.fromEntries(weekdays.map((day) => [day, '0'])), expectedPoints: Object.fromEntries(weekdays.map((day) => [day, 20])) };
    input.employees = [{ ...input.employees[0], role: ' Manager ', teamKey: 'site-a', teamRecordGroups: [[record], [colleague]] }];
    const row = buildPresencePerformanceRows(input)[0];
    expect(row.attendance).toBe(100); expect(row.performance).toBeCloseTo(100 / 6); expect(row.individual).toBeFalse();
    expect(row.performanceDays).toBe(6); expect(row.complete).toBeTrue(); expect(row.teamKey).toBe('site-a');
  });

  it('retains partial team scores, exposing a missing colleague expectation without reclassifying it as complete', () => {
    const input = source(); const record = input.employees[0].records[0];
    const colleague = { dailyPoints: { ...record.dailyPoints }, expectedPointsSince: '10-1-2026', expectedPoints: { ...record.expectedPoints } };
    delete colleague.expectedPoints['10-1-2026'];
    input.employees = [{ ...input.employees[0], role: 'Manager', teamRecordGroups: [[record], [colleague]] }];
    const row = buildPresencePerformanceRows(input)[0];
    expect(row.performance).toBe(50); expect(row.performanceDays).toBe(6);
    expect(row.missingPerformanceRecords).toBe(1); expect(row.performanceComplete).toBeFalse(); expect(row.complete).toBeFalse();
  });

  it('deduplicates copied legacy workload inside a team instead of treating copies as separate people', () => {
    const input = source(); const record = input.employees[0].records[0];
    record.totalDailyPoints = Object.fromEntries(weekdays.map((key) => [key, '10'])); delete record.expectedPoints;
    const colleague = { dailyPoints: Object.fromEntries(weekdays.map((day) => [day, '0'])), totalDailyPoints: Object.fromEntries(weekdays.map((day) => [day, '20'])) };
    input.employees = [{ ...input.employees[0], role: 'Manager', teamRecordGroups: [[record, { ...record }], [colleague]] }];
    expect(buildPresencePerformanceRows(input)[0].performance).toBeCloseTo(100 / 6);
  });

  it('leaves managers without a verified team denominator unavailable rather than using a personal score', () => {
    const input = source(); input.employees = [{ ...input.employees[0], role: 'Manager' }];
    expect(buildPresencePerformanceRows(input)[0].performance).toBeNull();
  });

  it('does not compute from unverified exceptions or a future month', () => {
    const employed = jasmine.createSpy('isEmployed');
    expect(buildPresencePerformanceRows(source({ exceptionsReady: false, isEmployed: employed }))).toEqual([]);
    expect(buildPresencePerformanceRows(source({ month: 11, isEmployed: employed }))).toEqual([]);
    expect(employed).not.toHaveBeenCalled();
  });

  it('retains attendance but suppresses performance after a source-stream failure', () => {
    const row = buildPresencePerformanceRows(source({ performanceReady: false }))[0];
    expect(row.attendance).toBe(100); expect(row.performance).toBeNull();
  });

  it('suppresses correlation for too few points or constant attendance and computes a real trend', () => {
    const base = buildPresencePerformanceRows(source())[0];
    const rows = [20, 40, 60, 80, 100].map((attendance) => ({ ...base, attendance, performance: attendance * 2 }));
    expect(presenceCorrelation(rows.slice(0, 4)).r).toBeNull();
    expect(presenceCorrelation(rows.map((row) => ({ ...row, attendance: 100 }))).r).toBeNull();
    expect(presenceCorrelation(rows).r).toBeCloseTo(1); expect(presenceCorrelation(rows).slope).toBeCloseTo(2);
  });

  it('calculates opposite individual and manager relationships separately and deduplicates shared sites', () => {
    const base = buildPresencePerformanceRows(source())[0];
    const employees = [20, 40, 60, 80, 100].map((attendance, index) => ({ ...base, id: `employee-${index}`, attendance, performance: attendance }));
    const managers = employees.map((row, index) => ({ ...row, id: `manager-${index}`, individual: false, role: 'Manager', teamKey: `site-${index}`, performance: 100 - row.attendance }));
    const regional = { ...managers[0], id: 'regional', role: 'Manager Regionale', attendance: 100 };
    const result = presenceCorrelationsByScope([...employees, regional, ...managers]);
    expect(result.individual.n).toBe(5); expect(result.individual.r).toBeCloseTo(1);
    expect(result.team.n).toBe(5); expect(result.team.r).toBeCloseTo(-1);
    expect(result.teamRows.some((row) => row.id === 'regional')).toBeFalse();
  });
});
