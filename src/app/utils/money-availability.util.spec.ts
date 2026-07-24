import {
  enforceEarliestMoneyDeliveryDate,
  getMoneyAvailability,
  isMoneyDeliveryDateAllowed,
  parseLocalDateInput,
  toLocalDateInputValue,
} from './money-availability.util';

describe('money availability policy', () => {
  const monday = new Date(2026, 6, 20);

  it('gives score 70+ clients the next open day', () => {
    const silver = getMoneyAvailability(70, monday);
    const gold = getMoneyAvailability(100, monday);

    expect(silver.earliestDateIso).toBe('2026-07-21');
    expect(silver.tier).toBe('best');
    expect(silver.bestClientLevel).toBe('Silver');
    expect(gold.bestClientLevel).toBe('Gold');
  });

  it('moves a Saturday best-client request to Monday', () => {
    const saturday = new Date(2026, 6, 25);

    expect(getMoneyAvailability(82, saturday).earliestDateIso).toBe(
      '2026-07-27'
    );
  });

  it('counts three open days for scores from 50 through 69', () => {
    const wednesday = new Date(2026, 6, 22);
    const thursday = new Date(2026, 6, 23);

    expect(getMoneyAvailability(50, wednesday).earliestDateIso).toBe(
      '2026-07-25'
    );
    expect(getMoneyAvailability(69, thursday).earliestDateIso).toBe(
      '2026-07-27'
    );
  });

  it('uses the same weekday next week below score 50', () => {
    const tuesday = new Date(2026, 6, 21);

    expect(getMoneyAvailability(49, tuesday).earliestDateIso).toBe(
      '2026-07-28'
    );
    expect(getMoneyAvailability(49, tuesday).tier).toBe('building');
  });

  it('falls back from a defensive Sunday request to the following Monday', () => {
    const sunday = new Date(2026, 6, 26);

    expect(getMoneyAvailability(40, sunday).earliestDateIso).toBe(
      '2026-08-03'
    );
  });

  it('parses and formats date-input values in local time', () => {
    const parsed = parseLocalDateInput('2026-07-21');

    expect(parsed).not.toBeNull();
    expect(toLocalDateInputValue(parsed!)).toBe('2026-07-21');
    expect(parseLocalDateInput('2026-02-30')).toBeNull();
  });

  it('allows the earliest or a later date and corrects an earlier date', () => {
    expect(
      isMoneyDeliveryDateAllowed('2026-07-23', '2026-07-23')
    ).toBeTrue();
    expect(
      isMoneyDeliveryDateAllowed('2026-07-30', '2026-07-23')
    ).toBeTrue();
    expect(
      isMoneyDeliveryDateAllowed('2026-07-22', '2026-07-23')
    ).toBeFalse();
    expect(
      enforceEarliestMoneyDeliveryDate('2026-07-22', '2026-07-23')
    ).toBe('2026-07-23');
    expect(enforceEarliestMoneyDeliveryDate('', '2026-07-23')).toBe(
      '2026-07-23'
    );
  });
});
