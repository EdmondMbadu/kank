import { SummaryCardCentralComponent } from './summary-card-central.component';
import { normalizeCardSmsSettings } from 'src/app/services/card-sms-settings.service';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { MessagingService } from 'src/app/services/messaging.service';
import { CardSmsSettingsService } from 'src/app/services/card-sms-settings.service';

describe('SummaryCardCentralComponent', () => {
  let component: SummaryCardCentralComponent;
  let auth: any;
  let cardSmsSettingsService: any;
  let compute: any;

  beforeEach(() => {
    auth = {
      isAdmin: true,
      isAdmninistrator: true,
      currentUser: {
        uid: 'site-user',
        firstName: 'Site',
        lastName: 'Admin',
      },
      makeAdmin: jasmine.createSpy('makeAdmin').and.resolveTo(),
    };
    cardSmsSettingsService = {
      save: jasmine.createSpy('save').and.resolveTo(),
    };
    compute = {
      convertCongoleseFrancToUsDollars: jasmine.createSpy('convert').and.callFake(
        (amount: string) => String(Math.round(Number(amount) / 3000))
      ),
    };
    component = new SummaryCardCentralComponent(
      {} as any,
      auth,
      {} as any,
      compute,
      {} as any,
      {} as any,
      {} as any,
      cardSmsSettingsService
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

  afterEach(() => component.ngOnDestroy());

  it('persists admin access before saving settings for an admin-session account', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.cardSmsEnabledInput = true;
    component.cardSmsThresholdInput = 75000;

    await component.saveCardSmsSettings();

    expect(auth.makeAdmin).toHaveBeenCalledTimes(1);
    expect(auth.currentUser.admin).toBe('true');
    expect(cardSmsSettingsService.save).toHaveBeenCalledWith(true, 75000, {
      uid: 'site-user',
      name: 'Site Admin',
    });
    expect(component.cardSmsSettingsSuccess).toBe(
      'Règle SMS cartes sauvegardée.'
    );
  });

  it('does not rewrite admin access when the account is already an admin', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    auth.currentUser.roles = ['admin'];
    component.cardSmsThresholdInput = 100000;

    await component.saveCardSmsSettings();

    expect(auth.makeAdmin).not.toHaveBeenCalled();
    expect(cardSmsSettingsService.save).toHaveBeenCalled();
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

  describe('location breakdowns', () => {
    const cards: any[] = [
      { uid: 'shared-id', ownerUid: 'a', locationName: 'Badiadingi', amountPaid: '65000', amountToPay: '5000' },
      { uid: 'ended', ownerUid: 'a', locationName: 'Badiadingi', clientCardStatus: 'ended', amountPaid: '95000', amountToPay: '5000' },
      { uid: 'shared-id', ownerUid: 'b', locationName: 'Barre', amountPaid: '3000', amountToPay: '5000' },
      { uid: 'missing-amounts', ownerUid: 'b', locationName: 'Barre' },
      { uid: 'unknown-site', amountPaid: '2000', amountToPay: '1000' },
    ];

    beforeEach(() => {
      component.allUsers = [
        { uid: 'a', firstName: 'Badiadingi' },
        { uid: 'b', firstName: 'Barre' },
        { uid: 'c', firstName: 'École' },
      ];
      component.filterAndInitializeClientsCard(cards);
    });

    it('reconciles every site breakdown with its central indicator', () => {
      expect(component.summaryContent).toEqual(['5', '4', '59000']);
      for (const index of [0, 1, 2]) {
        component.openSummaryModal(index);
        expect(component.summaryFilteredTotal).toBe(Number(component.summaryContent[index]));
      }
      expect(component.summaryLocations.map((row) => row.location)).toEqual([
        'Badiadingi', 'Barre', 'École', 'Site non renseigné',
      ]);
      expect(component.summaryLocations[0]).toEqual({ location: 'Badiadingi', total: 2, current: 1, savings: 60000, savingsUsd: 20 });
      expect(component.summaryLocations[1].savings).toBe(-2000);
      expect(component.summaryLocations[2].total).toBe(0);
    });

    it('deduplicates within a site without losing identical card IDs at other sites', () => {
      component.filterAndInitializeClientsCard([...cards, cards[0]]);
      expect(component.totalCardClients).toBe(5);
      expect(component.summaryLocations[1].total).toBe(2);
    });

    it('filters sites locally, handles accents, and keeps the central total unchanged', () => {
      component.openSummaryModal(2);
      component.summaryLocationSearch = '  BARRÉ  ';
      component.filterSummaryLocations();
      expect(component.summaryVisibleLocations.map((row) => row.location)).toEqual(['Barre']);
      expect(component.summaryFilteredTotal).toBe(-2000);
      expect(component.totalSavingsToReturn).toBe(59000);
      component.summaryLocationSearch = 'no match';
      component.filterSummaryLocations();
      expect(component.summaryVisibleLocations).toEqual([]);
      expect(component.summaryFilteredTotal).toBe(0);
      component.resetSummaryLocationSearch();
      expect(component.summaryFilteredTotal).toBe(59000);
    });

    it('ignores the SMS dashboard filters and resets search on reopening', () => {
      component.openSummaryModal(0);
      component.summaryLocationSearch = 'Barre';
      component.filterSummaryLocations();
      component.minAmountToPay = 99999999;
      component.cardSelectedLocations.clear();
      component.applyCardsFilters();
      component.closeSummaryModal();
      component.openSummaryModal(1);
      expect(component.summaryLocationSearch).toBe('');
      expect(component.summaryFilteredTotal).toBe(4);
    });

    it('reuses existing site streams for every modal and updates open totals live', () => {
      const stream = new Subject<any[]>();
      auth.getClientsCardOfAUser = jasmine.createSpy('getClientsCardOfAUser').and.returnValue(stream);
      component.allUsers = [{ uid: 'a', firstName: 'Badiadingi' }];
      component.getAllClientsCard();
      expect(component.cardsSummaryLoading).toBeTrue();
      stream.next([{ uid: 'one', amountPaid: '65000', amountToPay: '5000' }]);
      for (const index of [0, 1, 2, 0, 2]) {
        component.openSummaryModal(index);
        component.summaryLocationSearch = 'badi';
        component.filterSummaryLocations();
        component.closeSummaryModal();
      }
      component.openSummaryModal(2);
      expect(component.summaryFilteredTotal).toBe(60000);
      stream.next([{ uid: 'one', amountPaid: '95000', amountToPay: '5000' }]);
      expect(component.summaryFilteredTotal).toBe(90000);
      expect(component.cardsSummaryLoading).toBeFalse();
      expect(auth.getClientsCardOfAUser).toHaveBeenCalledOnceWith('a');
    });

    it('handles no sites, empty sites, and stream failures without false partial totals', () => {
      component.allUsers = [];
      component.getAllClientsCard();
      component.openSummaryModal(0);
      expect(component.summaryLocations).toEqual([]);
      expect(component.summaryFilteredTotal).toBe(0);
      component.allUsers = [{ uid: 'a', firstName: 'Badiadingi' }];
      auth.getClientsCardOfAUser = jasmine.createSpy().and.returnValue(of([]));
      component.getAllClientsCard();
      expect(component.summaryLocations[0].total).toBe(0);
      auth.getClientsCardOfAUser.and.returnValue(throwError(() => new Error('permission-denied')));
      component.getAllClientsCard();
      expect(component.cardsSummaryLoading).toBeFalse();
      expect(component.cardsSummaryError).toContain('Impossible de charger');
    });

    describe('rendered modal', () => {
      let fixture: ComponentFixture<SummaryCardCentralComponent>;

      beforeEach(async () => {
        await TestBed.configureTestingModule({
          declarations: [SummaryCardCentralComponent],
          imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterTestingModule],
          providers: [
            { provide: AuthService, useValue: auth },
            { provide: TimeService, useValue: {} },
            { provide: ComputationService, useValue: compute },
            { provide: MessagingService, useValue: {} },
            { provide: AngularFireFunctions, useValue: {} },
            { provide: AngularFirestore, useValue: {} },
            { provide: CardSmsSettingsService, useValue: cardSmsSettingsService },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        }).compileComponents();
        component.ngOnDestroy();
        spyOn(SummaryCardCentralComponent.prototype, 'ngOnInit');
        fixture = TestBed.createComponent(SummaryCardCentralComponent);
        component = fixture.componentInstance;
        component.allUsers = [{ uid: 'a', firstName: 'Badiadingi' }, { uid: 'b', firstName: 'Barre' }];
        component.filterAndInitializeClientsCard(cards);
        fixture.detectChanges();
      });

      afterEach(() => fixture.destroy());

      it('opens each card as a dialog, searches sites, and closes on the backdrop', fakeAsync(() => {
        const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button[aria-haspopup="dialog"]'));
        expect(buttons.length).toBe(3);
        buttons.forEach((button, index) => {
          button.click();
          fixture.detectChanges();
          tick();
          const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
          expect(dialog.querySelector('h2').textContent).toContain(component.summary[index]);
          expect(dialog.querySelectorAll('tbody tr').length).toBe(3);
          expect(dialog.textContent).toContain('Total central');
          const input: HTMLInputElement = dialog.querySelector('input');
          input.value = 'Barre';
          input.dispatchEvent(new Event('input'));
          fixture.detectChanges();
          tick();
          expect(dialog.querySelectorAll('tbody tr').length).toBe(1);
          expect(dialog.querySelector('tbody').textContent).toContain('Barre');
          dialog.click();
          expect(component.isSummaryModalOpen).toBeTrue();
          dialog.parentElement.click();
          fixture.detectChanges();
          expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
        });
      }));

      it('traps keyboard focus, closes with Escape, and restores focus and scroll', fakeAsync(() => {
        const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]');
        const originalOverflow = document.body.style.overflow;
        trigger.focus();
        trigger.click();
        fixture.detectChanges();
        tick();
        const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
        const close: HTMLButtonElement = dialog.querySelector('button');
        const reset: HTMLButtonElement = dialog.querySelectorAll('button')[1];
        expect(document.activeElement).toBe(close);
        expect(document.body.style.overflow).toBe('hidden');
        close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
        expect(document.activeElement).toBe(reset);
        reset.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(document.activeElement).toBe(close);
        close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();
        expect(component.isSummaryModalOpen).toBeFalse();
        expect(document.activeElement).toBe(trigger);
        expect(document.body.style.overflow).toBe(originalOverflow);
      }));

      it('renders loading and error states without showing stale site totals', () => {
        component.cardsSummaryLoading = true;
        component.openSummaryModal(2);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Chargement');
        expect(fixture.nativeElement.querySelector('[role="dialog"] table')).toBeNull();
        component.cardsSummaryLoading = false;
        component.cardsSummaryError = 'Impossible de charger';
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Impossible');
        expect(fixture.nativeElement.querySelector('[role="dialog"] table')).toBeNull();
      });
    });
  });
});
