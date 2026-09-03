import { SummaryCardCentralComponent } from './summary-card-central.component';
import { normalizeCardSmsSettings } from 'src/app/services/card-sms-settings.service';

describe('SummaryCardCentralComponent', () => {
  let component: SummaryCardCentralComponent;

  beforeEach(() => {
    component = new SummaryCardCentralComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    component.cardSmsSettings = normalizeCardSmsSettings({
      enabled: true,
      minimumAmountToPayFc: 50000,
    });
    component.cardsAll = [
      {
        uid: 'below-threshold',
        firstName: 'Visible',
        phoneNumber: '0812345678',
        amountToPay: '1000',
        locationName: 'Badiadingi',
      } as any,
      {
        uid: 'sms-ready',
        firstName: 'Ready',
        phoneNumber: '0823456789',
        amountToPay: '50000',
        locationName: 'Badiadingi',
      } as any,
      {
        uid: 'invalid-phone',
        firstName: 'Needs correction',
        phoneNumber: '+243823456789',
        amountToPay: '100000',
        locationName: 'Badiadingi',
      } as any,
    ];
    component.cardUniqueLocations = ['Badiadingi'];
    component.cardSelectedLocations.add('Badiadingi');
  });

  it('keeps cards visible below the global SMS threshold', () => {
    component.minAmountToPay = 1000;

    component.applyCardsFilters();

    expect(component.cardsFiltered.length).toBe(3);
    expect(component.cardsBelowSmsThresholdCount).toBe(1);
  });

  it('keeps invalid phone numbers visible but excludes them from SMS', () => {
    component.minAmountToPay = 1000;

    component.applyCardsFilters();

    expect(component.cardsInvalidPhoneCount).toBe(1);
    expect(component.cardBulkEligibleCount).toBe(1);
    expect(component.isCardSmsEligible(component.cardsFiltered[2])).toBeFalse();
  });
});
