import { Card } from '../../models/card';
import { DailyActivityRow, parseActivityDate, sortDailyActivityRows } from '../today-central/daily-activity-details';

export type DailyCardSnapshot = Pick<Card,
  'uid' | 'firstName' | 'middleName' | 'lastName' | 'name' | 'dateJoined' |
  'cardCycleStartDate' | 'cardCycle' | 'amountToPay' | 'payments' | 'withdrawal' |
  'totalWithdrawalSnapshot'
> & { locationId: string; locationName: string };

/** Retain only the selected month's maps and the fields used by the dialog. */
export function compactDailyCard(card: Card, locationId: string, locationName: string, monthKey: string): DailyCardSnapshot {
  const monthOnly = (values?: Record<string, string>) => Object.fromEntries(
    Object.entries(values || {}).filter(([key]) => parseActivityDate(key)?.monthKey === monthKey)
  );
  return {
    uid: card.uid, firstName: card.firstName, middleName: card.middleName,
    lastName: card.lastName, name: card.name, locationId, locationName,
    dateJoined: card.dateJoined, cardCycleStartDate: card.cardCycleStartDate,
    cardCycle: card.cardCycle, amountToPay: card.amountToPay,
    payments: monthOnly(card.payments), withdrawal: monthOnly(card.withdrawal),
    totalWithdrawalSnapshot: card.totalWithdrawalSnapshot ? {
      cardCycle: card.totalWithdrawalSnapshot.cardCycle,
      amountPaid: card.totalWithdrawalSnapshot.amountPaid,
      returnedAmount: card.totalWithdrawalSnapshot.returnedAmount,
      payments: monthOnly(card.totalWithdrawalSnapshot.payments),
      withdrawal: monthOnly(card.totalWithdrawalSnapshot.withdrawal),
    } : undefined,
  };
}

export function buildDailyCardRows(cards: DailyCardSnapshot[], metric: number, dayKey: string): DailyActivityRow[] {
  const day = parseActivityDate(dayKey)?.dayKey;
  if (!day || ![0, 1, 2].includes(metric)) return [];
  const rows = new Map<string, DailyActivityRow>();
  for (const card of cards) {
    const fullName = [card.firstName, card.middleName, card.lastName]
      .filter(Boolean).join(' ').trim() || card.name || 'Client carte';
    const add = (key: string | undefined, raw: unknown, detail: string, suffix = '') => {
      const date = parseActivityDate(key || '');
      const amount = Number(raw);
      if (date?.dayKey !== day || !Number.isFinite(amount) || amount === 0 || (metric !== 0 && amount < 0)) return;
      const id = `${metric}:${card.locationId}:${card.uid}:${key}:${suffix}`;
      rows.set(id, { id, fullName, locationId: card.locationId,
        locationName: card.locationName, amount, timestamp: date.timestamp,
        dateLabel: date.label, detail });
    };
    const snapshot = card.totalWithdrawalSnapshot;
    if (metric === 0) {
      // The last completed cycle can overlap with the current map. Current
      // values win, including zeroed corrections and signed withdrawals.
      Object.entries({ ...snapshot?.payments, ...card.payments }).forEach(([key, amount]) =>
        add(key, amount, Number(amount) < 0 ? 'Retrait partiel / transfert' : 'Dépôt carte')
      );
    } else if (metric === 1) {
      Object.entries({ ...snapshot?.withdrawal, ...card.withdrawal }).forEach(([key, amount]) =>
        add(key, amount, 'Retrait carte')
      );
    } else {
      // Benefits are the fee booked when a card or a new cycle starts, never
      // the sum of deposits or the client's refundable savings.
      const cycle = Math.max(1, Number(card.cardCycle) || 1);
      if (cycle === 1) {
        add(card.dateJoined, card.amountToPay, 'Frais de création', 'creation');
      } else {
        // Only attribute the original fee if the retained first-cycle snapshot
        // still identifies it. Do not invent older fees from today's rate.
        if (Number(snapshot?.cardCycle) === 1) {
          add(card.dateJoined, Number(snapshot?.amountPaid) - Number(snapshot?.returnedAmount), 'Frais de création', 'creation');
        }
        add(card.cardCycleStartDate, card.amountToPay, 'Frais de nouveau cycle', `cycle-${cycle}`);
      }
    }
  }
  return sortDailyActivityRows([...rows.values()]);
}
