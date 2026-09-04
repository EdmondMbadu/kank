import { Card, CardLifecycleEvent } from '../models/card';

export type CardPaymentActivityKind =
  | 'deposit'
  | 'partial_withdrawal'
  | 'total_withdrawal'
  | 'credit_transfer'
  | 'total_withdrawal_reversed'
  | 'manual_correction';

export interface CardPaymentActivity {
  kind: CardPaymentActivityKind;
  amount: number;
  dateKey: string;
  occurredAtMs: number;
  cycle: number;
  eventId?: string;
  paymentDateKey?: string;
}

export type CardLifecycleEventWithId = CardLifecycleEvent & { uid?: string };

export interface CardCycleSummary {
  cycle: number;
  amount: number;
  withdrawnAt: string;
  occurredAtMs: number;
}

function timestampFromDateKey(dateKey: string): number {
  const parts = String(dateKey || '')
    .split('-')
    .map((part) => Number(part));
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) {
    return 0;
  }

  const [month, day, year, hour = 0, minute = 0, second = 0] = parts;
  const timestamp = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function eventKind(event: CardLifecycleEvent): CardPaymentActivityKind | null {
  switch (event.type) {
    case 'card_created':
    case 'cycle_started':
    case 'deposit':
      return 'deposit';
    case 'partial_withdrawal':
    case 'total_withdrawal':
    case 'credit_transfer':
    case 'total_withdrawal_reversed':
    case 'manual_correction':
      return event.type;
    default:
      return null;
  }
}

function signature(activity: CardPaymentActivity): string {
  return `${activity.cycle}|${activity.kind}|${activity.dateKey}|${activity.amount}`;
}

function currentCycleNumber(card: Card): number {
  return Math.max(1, Math.floor(Number(card.cardCycle) || 1));
}

function isCycleEnded(card: Card): boolean {
  return !!card.clientCardStatus;
}

function withdrawalCycleAssignments(card: Card): CardCycleSummary[] {
  const withdrawals = {
    ...(card.totalWithdrawalSnapshot?.withdrawal || {}),
    ...(card.withdrawal || {}),
  };
  const sorted = Object.entries(withdrawals)
    .map(([withdrawnAt, rawAmount]) => ({
      withdrawnAt,
      amount: Math.abs(Number(rawAmount) || 0),
      occurredAtMs: timestampFromDateKey(withdrawnAt),
    }))
    .filter((entry) => entry.withdrawnAt && entry.amount > 0)
    .sort((a, b) => a.occurredAtMs - b.occurredAtMs);

  const currentCycle = currentCycleNumber(card);
  const firstCycle = Math.max(
    1,
    currentCycle - sorted.length + (isCycleEnded(card) ? 1 : 0)
  );

  return sorted.map((entry, index) => ({
    ...entry,
    cycle: firstCycle + index,
  }));
}

export function buildCompletedCardCycleSummaries(
  card: Card
): CardCycleSummary[] {
  return withdrawalCycleAssignments(card).sort((a, b) => b.cycle - a.cycle);
}

/**
 * Combines current card fields, the last total-withdrawal snapshot, and the
 * append-only lifecycle events. This keeps legacy records visible while also
 * recovering entries that an older one-entry `payments` write overwrote.
 */
export function buildCardPaymentActivities(
  card: Card,
  events: CardLifecycleEventWithId[] = []
): CardPaymentActivity[] {
  const activities = new Map<string, CardPaymentActivity>();
  const currentCycle = currentCycleNumber(card);
  const snapshotCycle = Math.max(
    1,
    Math.floor(Number(card.totalWithdrawalSnapshot?.cardCycle)) ||
      (isCycleEnded(card) ? currentCycle : currentCycle - 1)
  );

  for (const event of events) {
    const kind = eventKind(event);
    const amount = Math.abs(Number(event.amount) || 0);
    if (!kind || !event.occurredDateKey || amount <= 0) continue;

    const activity: CardPaymentActivity = {
      kind,
      amount,
      dateKey: event.occurredDateKey,
      cycle: Math.max(1, Math.floor(Number(event.cycle) || 1)),
      occurredAtMs:
        Number(event.occurredAtMs) || timestampFromDateKey(event.occurredDateKey),
      ...(event.uid ? { eventId: event.uid } : {}),
    };
    activities.set(signature(activity), activity);
  }

  const addPayments = (
    payments: Card['payments'],
    cycle: number,
    markAsCurrent: boolean
  ) => {
    for (const [dateKey, rawAmount] of Object.entries(payments || {})) {
      const signedAmount = Number(rawAmount) || 0;
      if (!dateKey || signedAmount === 0) continue;

      const activity: CardPaymentActivity = {
        kind: signedAmount > 0 ? 'deposit' : 'partial_withdrawal',
        amount: Math.abs(signedAmount),
        dateKey,
        cycle,
        occurredAtMs: timestampFromDateKey(dateKey),
        ...(markAsCurrent ? { paymentDateKey: dateKey } : {}),
      };
      const key = signature(activity);
      const existing = activities.get(key);
      activities.set(key, {
        ...activity,
        occurredAtMs: existing?.occurredAtMs || activity.occurredAtMs,
        ...(existing?.eventId ? { eventId: existing.eventId } : {}),
      });
    }
  };

  // The snapshot can retain deposits from a cycle after a total withdrawal.
  addPayments(card.totalWithdrawalSnapshot?.payments, snapshotCycle, false);
  addPayments(card.payments, currentCycle, true);

  for (const withdrawal of withdrawalCycleAssignments(card)) {
    const activity: CardPaymentActivity = {
      kind: 'total_withdrawal',
      amount: withdrawal.amount,
      dateKey: withdrawal.withdrawnAt,
      cycle: withdrawal.cycle,
      occurredAtMs: withdrawal.occurredAtMs,
    };
    const key = signature(activity);
    const existing = activities.get(key);
    if (!existing) activities.set(key, activity);
  }

  return Array.from(activities.values()).sort(
    (a, b) => b.occurredAtMs - a.occurredAtMs
  );
}
