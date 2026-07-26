import {
  createMoneyAvailabilityPolicySnapshot,
  enforceEarliestMoneyDeliveryDate,
  formatOpenDaysLabel,
  getMoneyAvailability,
  isMoneyDeliveryDateAllowed,
  normalizeMoneyAvailabilityPolicy,
  parseLocalDateInput,
  toLocalDateInputValue,
  validateMoneyAvailabilityRules,
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

  it('counts six open days from a defensive Sunday request', () => {
    const sunday = new Date(2026, 6, 26);

    expect(getMoneyAvailability(40, sunday).earliestDateIso).toBe(
      '2026-08-01'
    );
  });

  it('supports independently configurable 50–59 and 60–69 ranges', () => {
    const policy = {
      version: 7,
      rules: [
        { id: 'low', minScore: null, maxScore: 49, openDays: 6 },
        { id: '50s', minScore: 50, maxScore: 59, openDays: 2 },
        { id: '60s', minScore: 60, maxScore: 69, openDays: 4 },
        { id: 'best', minScore: 70, maxScore: null, openDays: 1 },
      ],
    };

    expect(getMoneyAvailability(55, monday, policy).openDays).toBe(2);
    expect(getMoneyAvailability(65, monday, policy).openDays).toBe(4);
    expect(getMoneyAvailability(65, monday, policy).policyVersion).toBe(7);
  });

  it('rejects gaps and overlaps and falls back to the safe default policy', () => {
    const invalidRules = [
      { id: 'low', minScore: null, maxScore: 50, openDays: 4 },
      { id: 'high', minScore: 50, maxScore: null, openDays: 1 },
    ];

    expect(validateMoneyAvailabilityRules(invalidRules).length).toBeGreaterThan(
      0
    );
    expect(
      normalizeMoneyAvailabilityPolicy({
        version: 99,
        rules: invalidRules,
      }).version
    ).toBe(1);
    expect(getMoneyAvailability(50, monday, { version: 99, rules: invalidRules }).openDays)
      .toBe(3);
  });

  it('formats zero, singular, and plural open-day labels', () => {
    expect(formatOpenDaysLabel(0)).toBe('Même jour');
    expect(formatOpenDaysLabel(1)).toBe('1 jour ouvrable');
    expect(formatOpenDaysLabel(2)).toBe('2 jours ouvrables');
  });

  it('captures the exact policy source and rule used for a saved request', () => {
    const availability = getMoneyAvailability(55, monday, {
      version: 12,
      rules: [
        { id: 'low', minScore: null, maxScore: 49, openDays: 6 },
        { id: 'site-standard', minScore: 50, maxScore: 69, openDays: 2 },
        { id: 'best', minScore: 70, maxScore: null, openDays: 1 },
      ],
    });
    const snapshot = createMoneyAvailabilityPolicySnapshot(
      availability,
      {
        policy: {
          version: 12,
          rules: [
            { id: 'low', minScore: null, maxScore: 49, openDays: 6 },
            {
              id: 'site-standard',
              minScore: 50,
              maxScore: 69,
              openDays: 2,
            },
            { id: 'best', minScore: 70, maxScore: null, openDays: 1 },
          ],
        },
        source: 'location',
        locationId: 'site-a',
      },
      123456
    );

    expect(snapshot).toEqual(
      jasmine.objectContaining({
        version: 12,
        source: 'location',
        locationId: 'site-a',
        ruleId: 'site-standard',
        openDays: 2,
        calculatedAtMs: 123456,
      })
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
