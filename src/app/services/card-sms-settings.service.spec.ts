import {
  DEFAULT_CARD_SMS_MINIMUM_FC,
  normalizeCardSmsSettings,
} from './card-sms-settings.service';

describe('normalizeCardSmsSettings', () => {
  it('fails closed with the safe default threshold', () => {
    expect(normalizeCardSmsSettings(undefined)).toEqual({
      enabled: false,
      minimumAmountToPayFc: DEFAULT_CARD_SMS_MINIMUM_FC,
      updatedAtMs: 0,
      updatedByUid: '',
      updatedByName: '',
      version: 0,
    });
  });

  it('accepts a saved positive integer threshold', () => {
    const settings = normalizeCardSmsSettings({
      enabled: true,
      minimumAmountToPayFc: 500000,
      version: 3,
    });

    expect(settings.enabled).toBeTrue();
    expect(settings.minimumAmountToPayFc).toBe(500000);
    expect(settings.version).toBe(3);
  });
});
