import {
  auditVerificationSortValue,
  getAuditVerificationTiming,
  previousOpenDay,
} from './audit-verification.util';

describe('audit verification timing', () => {
  it('uses the previous open day as the audit deadline', () => {
    const friday = new Date(2026, 6, 24);
    const monday = new Date(2026, 6, 27);

    expect(previousOpenDay(friday)).toEqual(new Date(2026, 6, 23));
    expect(previousOpenDay(monday)).toEqual(new Date(2026, 6, 25));
  });

  it('makes a next-open-day best client due today', () => {
    const thursday = new Date(2026, 6, 23);
    const fridayMoneyDate = new Date(2026, 6, 24);
    const timing = getAuditVerificationTiming(fridayMoneyDate, thursday);

    expect(timing.status).toBe('today');
    expect(timing.deadline).toEqual(thursday);
  });

  it('treats Monday as the next audit day after Saturday', () => {
    const saturday = new Date(2026, 6, 25);
    const tuesdayMoneyDate = new Date(2026, 6, 28);
    const timing = getAuditVerificationTiming(tuesdayMoneyDate, saturday);

    expect(timing.status).toBe('next');
    expect(timing.deadline).toEqual(new Date(2026, 6, 27));
    expect(timing.isCalendarTomorrow).toBeFalse();
  });

  it('distinguishes future, overdue, and missing deadlines', () => {
    const monday = new Date(2026, 6, 20);
    const fridayMoneyDate = new Date(2026, 6, 24);
    const future = getAuditVerificationTiming(fridayMoneyDate, monday);
    const overdue = getAuditVerificationTiming(monday, fridayMoneyDate);
    const missing = getAuditVerificationTiming(null, monday);

    expect(future.status).toBe('future');
    expect(future.openDaysRemaining).toBe(3);
    expect(overdue.status).toBe('overdue');
    expect(missing.status).toBe('missing');
    expect(auditVerificationSortValue(missing)).toBe(
      Number.POSITIVE_INFINITY
    );
  });
});
