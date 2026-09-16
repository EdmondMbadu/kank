import { Client } from '../../models/client';
import { EmployeeCashPayment } from '../../models/employee-cash-payment';

export type DailyActivityKind = 'payment' | 'lending' | 'cash-payment';

export interface DailyActivityRow {
  id: string;
  fullName: string;
  locationId: string;
  locationName: string;
  amount: number;
  dateLabel: string;
  timestamp: number;
  detail: string;
}

// Parse the stored calendar date directly, not through browser-dependent Date
// parsing or timezone conversion. In particular, day 1 must not match day 10.
export function parseActivityDate(raw: string): {
  dayKey: string; monthKey: string; timestamp: number; label: string;
} | null {
  const value = String(raw || '').trim();
  const legacy = /^(\d{1,2})-(\d{1,2})-(\d{4})(?:-(\d{1,2})-(\d{1,2})-(\d{1,2})(?:-\d+)?)?$/.exec(value);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  if (!legacy && !iso) return null;
  const match = (legacy || iso)!;
  const year = Number(match[legacy ? 3 : 1]);
  const month = Number(match[legacy ? 1 : 2]);
  const day = Number(match[legacy ? 2 : 3]);
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const second = Number(match[6] || 0);
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(timestamp);
  if (year < 1900 || date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day ||
      hour > 23 || minute > 59 || second > 59) return null;
  const pad = (part: number) => String(part).padStart(2, '0');
  return {
    dayKey: `${month}-${day}-${year}`,
    monthKey: `${year}-${pad(month)}`,
    timestamp,
    label: `${pad(day)}/${pad(month)}/${year}` +
      (match[4] !== undefined ? ` · ${pad(hour)}:${pad(minute)}` : ''),
  };
}

export function buildDailyActivityRows(
  clients: Client[], kind: Exclude<DailyActivityKind, 'cash-payment'>, dayKey: string
): DailyActivityRow[] {
  const selectedDay = parseActivityDate(dayKey)?.dayKey;
  if (!selectedDay) return [];
  const [month, day, year] = selectedDay.split('-');
  const dayPrefix = new RegExp(`^(?:0?${month}-0?${day}-${year}(?:-|$)|${year}-0?${month}-0?${day}(?:T|$))`);
  const rows = new Map<string, DailyActivityRow>();
  clients.forEach((client, index) => {
    // Pending transfers are copies of the source dossier, not new activity at
    // the destination. The source remains authoritative until acceptance.
    if (client.transferStatus === 'pending') return;
    const locationId = client.locationOwnerId || client.locationName || 'site';
    const fullName = [client.firstName, client.lastName, client.middleName]
      .filter(Boolean).join(' ').trim() || client.name || 'Client';
    const clientId = `${locationId}:${client.uid || `anonymous-${index}`}`;
    const add = (key: string, rawAmount: string | undefined, detail: string) => {
      // Skip other days before constructing Date objects for large histories.
      if (!dayPrefix.test(key)) return;
      const parsed = parseActivityDate(key);
      const amount = Number(rawAmount);
      if (!parsed || parsed.dayKey !== selectedDay || !Number.isFinite(amount) ||
          amount === 0 || (kind === 'lending' && amount < 0)) return;
      const id = `${kind}:${clientId}:${key}`;
      rows.set(id, {
        id, fullName, locationId, locationName: client.locationName || 'Site',
        amount, dateLabel: parsed.label, timestamp: parsed.timestamp, detail,
      });
    };
    if (kind === 'lending') {
      add(client.debtCycleStartDate || '', client.loanAmount, client.paymentPeriodRange || '');
    } else {
      // A cycle rollover can leave the same key in both maps. Current values
      // take precedence, just as in the daily payment view; do not count twice.
      const payments = { ...client.previousPayments, ...client.payments };
      const sources = { ...client.previousPaymentSources, ...client.paymentSources };
      Object.entries(payments).forEach(([key, amount]) =>
        add(key, amount, sources[key] === 'mobile_money' ? 'Mobile Money' : 'Paiement')
      );
    }
  });
  return sortDailyActivityRows([...rows.values()]);
}

export function buildDailyCashPaymentRows(
  payments: EmployeeCashPayment[], sites: ReadonlyMap<string, string>, dayKey: string
): DailyActivityRow[] {
  const selectedDay = parseActivityDate(dayKey);
  if (!selectedDay) return [];
  const rows = new Map<string, DailyActivityRow>();
  payments.forEach((payment) => {
    if (payment.dayKey !== selectedDay.dayKey || !sites.has(payment.ownerUid) ||
        !Number.isFinite(payment.amount) || payment.amount === 0) return;
    rows.set(payment.id, {
      id: payment.id, fullName: payment.fullName,
      locationId: payment.ownerUid, locationName: sites.get(payment.ownerUid) || 'Site',
      amount: payment.amount, dateLabel: selectedDay.label,
      timestamp: payment.createdAtMs,
      detail: payment.source === 'mobile_money' ? 'Mobile Money confirmé' : 'Paiement direct',
    });
  });
  return sortDailyActivityRows([...rows.values()]);
}

function sortDailyActivityRows(rows: DailyActivityRow[]): DailyActivityRow[] {
  const locations = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
  const names = new Intl.Collator('fr');
  return rows.sort((a, b) =>
    locations.compare(a.locationName, b.locationName) ||
    a.locationId.localeCompare(b.locationId) || b.timestamp - a.timestamp ||
    names.compare(a.fullName, b.fullName) || a.id.localeCompare(b.id)
  );
}
