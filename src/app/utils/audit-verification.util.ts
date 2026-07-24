export type AuditVerificationStatus =
  | 'missing'
  | 'overdue'
  | 'today'
  | 'next'
  | 'future';

export interface AuditVerificationTiming {
  deadline: Date | null;
  status: AuditVerificationStatus;
  openDaysRemaining: number | null;
  isCalendarTomorrow: boolean;
}

const SUNDAY = 0;

function localDateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function previousOpenDay(value: Date): Date {
  const result = localDateOnly(value);
  result.setDate(result.getDate() - 1);

  while (result.getDay() === SUNDAY) {
    result.setDate(result.getDate() - 1);
  }

  return result;
}

function countOpenDaysUntil(start: Date, end: Date): number {
  const cursor = localDateOnly(start);
  const endDay = localDateOnly(end);
  let openDays = 0;

  while (cursor < endDay) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() !== SUNDAY) {
      openDays += 1;
    }
  }

  return openDays;
}

export function getAuditVerificationTiming(
  moneyDate: Date | null,
  today: Date = new Date()
): AuditVerificationTiming {
  if (!moneyDate || Number.isNaN(moneyDate.getTime())) {
    return {
      deadline: null,
      status: 'missing',
      openDaysRemaining: null,
      isCalendarTomorrow: false,
    };
  }

  const todayStart = localDateOnly(today);
  const deadline = previousOpenDay(moneyDate);

  if (deadline < todayStart) {
    return {
      deadline,
      status: 'overdue',
      openDaysRemaining: 0,
      isCalendarTomorrow: false,
    };
  }

  if (deadline.getTime() === todayStart.getTime()) {
    return {
      deadline,
      status: 'today',
      openDaysRemaining: 0,
      isCalendarTomorrow: false,
    };
  }

  const openDaysRemaining = countOpenDaysUntil(todayStart, deadline);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    deadline,
    status: openDaysRemaining === 1 ? 'next' : 'future',
    openDaysRemaining,
    isCalendarTomorrow: deadline.getTime() === tomorrow.getTime(),
  };
}

export function auditVerificationSortValue(
  timing: AuditVerificationTiming
): number {
  if (!timing.deadline) {
    return Number.POSITIVE_INFINITY;
  }

  return timing.deadline.getTime();
}
