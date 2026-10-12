import type { Employee } from 'src/app/models/employee';
import { logicalPointPerformanceDays, pointDayTime, summarizePointDays } from 'src/app/utils/point-performance.util';

export interface PresencePerformanceSource {
  month: number;
  year: number;
  throughDay: string;
  periodLabel: string;
  exceptionsReady: boolean;
  performanceReady: boolean;
  excludedDates: readonly string[];
  employees: readonly {
    id: string; name: string; role: string; location: string; records: readonly Employee[];
    teamKey?: string;
    teamRecordGroups?: readonly (readonly Employee[])[];
  }[];
  isEmployed: (employee: Employee, day: string) => boolean;
  normalizeStatus: (raw: unknown) => string;
}

export interface PresencePerformanceRow {
  id: string; name: string; role: string; location: string;
  days: number; expected: number; present: number; late: number; absent: number;
  leave: number; missing: number; other: number;
  attendance: number | null; performance: number | null; complete: boolean;
  individual: boolean;
  performanceDays: number; performanceComplete: boolean;
  missingPerformanceRecords: number; teamKey: string;
}

/** One pass over attendance per person, bounded performance work to one month.
 * All input is already in memory; this module never reads or writes a backend. */
export function buildPresencePerformanceRows(source: PresencePerformanceSource): PresencePerformanceRow[] {
  if (!source.exceptionsReady) return [];
  const cutoff = pointDayTime(source.throughDay);
  if (cutoff === null) return [];
  const excluded = new Set(source.excludedDates);
  const dates: string[] = [];
  for (let day = 1; day <= new Date(source.year, source.month, 0).getDate(); day++) {
    const time = Date.UTC(source.year, source.month - 1, day);
    if (time > cutoff) break;
    const weekday = new Date(time).getUTCDay();
    const key = `${source.month}-${day}-${source.year}`;
    const iso = `${source.year}-${String(source.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (weekday !== 0 && weekday !== 6 && !excluded.has(iso)) dates.push(key);
  }
  if (!dates.length) return [];
  return source.employees.map((entry) => {
    const attendance = new Map<string, { seconds: number; status: string }>();
    for (const record of entry.records) {
      for (const [rawKey, rawStatus] of Object.entries(record.attendance || {})) {
        const [m, d, y, hh = 0, mm = 0, ss = 0] = rawKey.split('-').map(Number);
        if (m !== source.month || y !== source.year) continue;
        const key = `${m}-${d}-${y}`;
        if (!source.isEmployed(record, key)) continue;
        const seconds = hh * 3600 + mm * 60 + ss;
        const existing = attendance.get(key);
        // On ties retain the first (representative-priority) record.
        if (!existing || seconds > existing.seconds) attendance.set(key, { seconds, status: source.normalizeStatus(rawStatus) });
      }
    }
    const row: PresencePerformanceRow = { ...entry, days: 0, expected: 0, present: 0, late: 0,
      absent: 0, leave: 0, missing: 0, other: 0, attendance: null, performance: null, complete: false,
      individual: !entry.role.trim().toLowerCase().includes('manager'), performanceDays: 0, performanceComplete: false,
      missingPerformanceRecords: 0, teamKey: entry.teamKey || entry.location };
    const workingDates = new Set<string>();
    for (const key of dates) {
      if (!entry.records.some((record) => source.isEmployed(record, key))) continue;
      row.days++;
      const status = attendance.get(key)?.status || '';
      if (status === 'V' || status === 'VP') { row.leave++; continue; }
      row.expected++;
      workingDates.add(key);
      if (status === 'P') row.present++;
      else if (status === 'L') row.late++;
      else if (status === 'A') row.absent++;
      else if (!status) row.missing++;
      else row.other++;
    }
    row.attendance = row.expected > 0 ? (row.present + row.late) * 100 / row.expected : null;
    if (source.performanceReady && workingDates.size) {
      const through = new Date(Math.min(Date.UTC(source.year, source.month, 0), cutoff));
      const throughDay = `${through.getUTCMonth() + 1}-${through.getUTCDate()}-${through.getUTCFullYear()}`;
      const groups = row.individual ? [entry.records] : entry.teamRecordGroups || [];
      const points = [];
      const coveredDates = new Set<string>();
      for (const group of groups) {
        const groupDays = logicalPointPerformanceDays(group, throughDay, `${source.month}-1-${source.year}`)
          .filter((day) => workingDates.has(day.key));
        // People without any points workload (e.g. verifiers) do not supply
        // a denominator for the team's points metric, matching the ranking.
        if (!row.individual && !groupDays.length) continue;
        const verified = groupDays.filter((day) => day.possible !== null);
        const known = new Set(verified.map((day) => day.key));
        for (const key of workingDates) {
          if (!known.has(key) && (row.individual || group.some((record) => source.isEmployed(record, key)) || groupDays.some((day) => day.key === key))) row.missingPerformanceRecords++;
        }
        verified.forEach((day) => coveredDates.add(day.key));
        points.push(...verified);
      }
      // Historical daily expectations can have gaps. Keep the employee visible
      // using ONLY matched earned/expected days, flag coverage, and never treat
      // that partial ratio as the complete month's performance or correlation.
      // A missing independent location capture invalidates that date even when
      // another location has a valid copy (logicalPointPerformanceDays handles it).
      row.performanceDays = coveredDates.size;
      row.performanceComplete = row.performanceDays === workingDates.size && row.missingPerformanceRecords === 0;
      row.performance = summarizePointDays(points).percent;
    }
    row.complete = row.attendance !== null && row.performance !== null && row.performanceComplete && row.missing === 0 && row.other === 0;
    return row;
  }).filter((row) => row.days > 0);
}

export interface PresenceCorrelation { n: number; r: number | null; slope: number | null; intercept: number | null; }
export function presenceCorrelation(rows: readonly PresencePerformanceRow[]): PresenceCorrelation {
  const pairs = rows.filter((row) => row.complete && row.attendance !== null && row.performance !== null);
  const n = pairs.length;
  const empty = { n, r: null, slope: null, intercept: null };
  if (n < 5) return empty;
  const meanX = pairs.reduce((sum, row) => sum + row.attendance!, 0) / n;
  const meanY = pairs.reduce((sum, row) => sum + row.performance!, 0) / n;
  let xx = 0, yy = 0, xy = 0;
  for (const row of pairs) {
    const dx = row.attendance! - meanX, dy = row.performance! - meanY;
    xx += dx * dx; yy += dy * dy; xy += dx * dy;
  }
  if (xx <= 1e-10 || yy <= 1e-10) return empty;
  const slope = xy / xx;
  return { n, r: Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy))), slope, intercept: meanY - slope * meanX };
}

/** Team results are a different outcome from individual results. Keep the two
 * populations separate, and count a site's result only once when a regional
 * and local manager both appear on the chart. Prefer the site's local manager. */
export function presenceCorrelationsByScope(rows: readonly PresencePerformanceRow[]): {
  individual: PresenceCorrelation; team: PresenceCorrelation;
  individualRows: PresencePerformanceRow[]; teamRows: PresencePerformanceRow[];
} {
  const managers = new Map<string, PresencePerformanceRow>();
  for (const row of rows.filter((item) => !item.individual && item.complete)) {
    const previous = managers.get(row.teamKey);
    if (!previous || row.role.trim().toLowerCase() === 'manager') managers.set(row.teamKey, row);
  }
  const individualRows = rows.filter((row) => row.individual);
  const teamRows = [...managers.values()];
  return { individual: presenceCorrelation(individualRows), team: presenceCorrelation(teamRows), individualRows, teamRows };
}
