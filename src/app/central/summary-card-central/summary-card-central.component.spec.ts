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
      {
        uid: 'completed',
        firstName: 'Completed',
        phoneNumber: '0898765432',
        amountToPay: '100000',
        clientCardStatus: 'ended',
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

  it('shows only current clients by default', () => {
    component.minAmountToPay = 0;

    component.applyCardsFilters();

    expect(component.doneFilter).toBe('exclude');
    expect(component.cardsFiltered.map((card) => card.uid)).not.toContain(
      'completed'
    );
  });

  it('keeps invalid phone numbers visible but excludes them from SMS', () => {
    component.minAmountToPay = 1000;

    component.applyCardsFilters();

    expect(component.cardsInvalidPhoneCount).toBe(1);
    expect(component.cardBulkEligibleCount).toBe(1);
    expect(component.isCardSmsEligible(component.cardsFiltered[2])).toBeFalse();
  });

  it('opens and closes the selected card details modal', () => {
    const selectedCard = component.cardsAll[1];

    component.openCardDetailsModal(selectedCard);

    expect(component.cardDetailsModal.open).toBeTrue();
    expect(component.cardDetailsModal.client).toBe(selectedCard);
    expect(component.cardFullName(selectedCard)).toBe('Ready');
    expect(component.cardAmountToReturn(selectedCard)).toBe(0);

    component.closeCardDetailsModal();

    expect(component.cardDetailsModal.open).toBeFalse();
    expect(component.cardDetailsModal.client).toBeNull();
  });
});
