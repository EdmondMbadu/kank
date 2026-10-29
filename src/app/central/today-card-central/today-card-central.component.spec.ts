import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TodayCardCentralComponent } from './today-card-central.component';

describe('TodayCardCentralComponent', () => {
  let component: TodayCardCentralComponent;
  let fixture: ComponentFixture<TodayCardCentralComponent>;
  let auth: any;
  let users: BehaviorSubject<any[]>;
  const sites = [
    { uid: 'a', firstName: 'Badiadingi', dailyCardPayments: { '10-29-2026': '150' }, dailyCardReturns: { '10-29-2026': '60' }, dailyCardBenefits: { '10-29-2026': '5' } },
    { uid: 'b', firstName: 'Barre', dailyCardPayments: { '10-29-2026': '200' }, dailyCardReturns: {}, dailyCardBenefits: { '10-29-2026': '10' } },
  ];
  const siteCards: Record<string, any[]> = {
    a: [{ uid: 'same-id', firstName: 'Esther', lastName: 'Mbala', dateJoined: '10-29-2026', amountToPay: '5',
      payments: { '10-29-2026-9-0-0': '150', '10-30-2026-9-0-0': '25' }, withdrawal: { '10-29-2026-10-0-0': '60' } }],
    b: [{ uid: 'same-id', firstName: 'Martin', dateJoined: '10-29-2026', amountToPay: '10', payments: { '10-29-2026-8-0-0': '200' } }],
  };

  beforeEach(async () => {
    users = new BehaviorSubject<any[]>(sites);
    auth = {
      isAdmin: true, currentUser: { email: '', firstName: 'Central' },
      getAllUsersInfo: jasmine.createSpy().and.returnValue(users),
      getCardsOfAUserForMonth: jasmine.createSpy().and.callFake((site: string) => of(siteCards[site])),
    };
    const time = {
      getTodaysDateYearMonthDay: () => '2026-10-29', todaysDateMonthDayYear: () => '10-29-2026',
      convertDateToMonthDayYear: (date: string) => { const [year, month, day] = date.split('-'); return `${Number(month)}-${Number(day)}-${year}`; },
      convertDateToDayMonthYear: (date: string) => { const [month, day, year] = date.split('-'); return `${day}/${month}/${year}`; },
    };
    const compute = {
      findTodayTotalResultsGivenField: (data: any[], field: string, date: string) => String(data.reduce((sum, user) => sum + Number(user[field]?.[date] || 0), 0)),
      convertCongoleseFrancToUsDollars: (value: string) => Math.ceil(Number(value) / 3000),
    };
    await TestBed.configureTestingModule({
      declarations: [TodayCardCentralComponent], imports: [CommonModule, FormsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth }, { provide: TimeService, useValue: time },
        { provide: ComputationService, useValue: compute },
      ], schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(TodayCardCentralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  async function open(metric: number): Promise<void> {
    component.openDetails(metric);
    await component.loadDetails();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('loads no client history until a summary card is opened', () => {
    expect(component.summaryContent.map(Number)).toEqual([350, 60, 15]);
    expect(auth.getCardsOfAUserForMonth).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('button[aria-haspopup="dialog"]').length).toBe(3);
  });

  it('opens all three cards with named clients grouped by location and matching totals', async () => {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button[aria-haspopup="dialog"]'));
    for (const [index, button] of buttons.entries()) {
      button.click(); await component.loadDetails(); fixture.detectChanges(); await fixture.whenStable();
      const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
      expect(dialog.querySelector('h2').textContent).toContain(component.summary[index]);
      expect(dialog.textContent).toContain('Esther Mbala');
      expect(component.detailTotal).toBe(component.detailCentralTotal);
      expect(component.detailGroups.map((group) => group.name)).toEqual(index === 1 ? ['Badiadingi'] : ['Badiadingi', 'Barre']);
      dialog.querySelector('button').click(); fixture.detectChanges();
      expect(component.isDetailsOpen).toBeFalse();
    }
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(2);
  });

  it('searches clients and sites locally, handles accents, and resets filters', async () => {
    await open(0);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#daily-card-search');
    input.value = 'ésther'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    expect(component.filteredRows.length).toBe(1);
    expect(component.detailFilteredTotal).toBe(150);
    component.resetDetailFilters(); component.detailSite = 'b'; component.applyDetailFilters();
    expect(component.filteredRows[0].fullName).toBe('Martin');
    expect(component.detailFilteredTotal).toBe(200);
    expect(component.detailCentralTotal).toBe(350);
    component.detailSearch = 'absent'; component.applyDetailFilters(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]').textContent).toContain('Aucune opération ne correspond');
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(2);
  });

  it('reuses one monthly snapshot across dates and cards and refreshes explicitly', async () => {
    await open(0);
    component.onDateChange('2026-10-30'); await component.loadDetails();
    expect(component.detailTotal).toBe(25);
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(2);
    await open(2); expect(component.detailTotal).toBe(0);
    await component.loadDetails(true);
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(4);
  });

  it('deduplicates simultaneous loads and ignores responses for a previous metric or date', fakeAsync(() => {
    const october = new Subject<any[]>(); const november = new Subject<any[]>();
    auth.getCardsOfAUserForMonth.and.callFake((_site: string, month: string) => month === '2026-10' ? october : november);
    component.openDetails(0); component.openDetails(1);
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(2);
    component.onDateChange('2026-11-01');
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(4);
    november.next([{ uid: 'new', firstName: 'Novembre', withdrawal: { '11-1-2026': '20' } }]); flushMicrotasks();
    expect(component.detailTotal).toBe(40);
    october.next(siteCards['a']); flushMicrotasks();
    expect(component.detailTotal).toBe(40);
    expect(component.detailRows.every((row) => row.fullName === 'Novembre')).toBeTrue(); tick();
  }));

  it('invalidates a monthly snapshot when the recorded site totals change', async () => {
    await open(0);
    users.next([{ ...sites[0], dailyCardPayments: { '10-29-2026': '175' } }, sites[1]]);
    await component.loadDetails();
    expect(component.detailCentralTotal).toBe(375);
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(4);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]').textContent).toContain('Écart avec le total central');
  });

  it('shows errors instead of partial site results and allows retry', async () => {
    spyOn(console, 'error');
    auth.getCardsOfAUserForMonth.and.callFake((site: string) => site === 'a' ? of(siteCards[site]) : throwError(() => new Error('denied')));
    await open(0);
    expect(component.detailsError).toContain('Impossible de charger tous les sites');
    expect(component.detailRows).toEqual([]); expect(component.detailGroups).toEqual([]);
    expect(fixture.nativeElement.querySelector('[role="dialog"] table')).toBeNull();
    auth.getCardsOfAUserForMonth.and.callFake((site: string) => of(siteCards[site]));
    await component.loadDetails(true);
    expect(component.detailTotal).toBe(350); expect(component.detailsError).toBe('');
  });

  it('renders loading state and does not populate a closed modal after a late response', fakeAsync(() => {
    const pending = new Subject<any[]>(); auth.getCardsOfAUserForMonth.and.returnValue(pending);
    component.openDetails(0); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"] [role="status"]').textContent).toContain('Chargement des clients');
    component.closeDetails(); pending.next(siteCards['a']); flushMicrotasks();
    expect(component.detailRows).toEqual([]); expect(component.isDetailsOpen).toBeFalse(); tick();
  }));

  it('paginates large lists without requests and retains complete site and filtered totals', async () => {
    await open(0);
    component.detailRows = Array.from({ length: 205 }, (_, index) => ({ ...component.detailRows[0], id: String(index), amount: 1 }));
    component.applyDetailFilters();
    expect(component.detailGroups[0].rows.length).toBe(100);
    expect(component.detailGroups[0].filteredTotal).toBe(205);
    component.changeDetailPage(2);
    expect(component.detailGroups[0].rows.length).toBe(5);
    expect(component.detailFilteredTotal).toBe(205); expect(component.detailPageCount).toBe(3);
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(2);
  });

  it('keeps the month cache bounded when visiting many months', async () => {
    await open(0);
    for (const date of ['2026-11-01', '2026-12-01', '2026-10-29']) {
      component.onDateChange(date); await component.loadDetails();
    }
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(8);
  });

  it('handles empty sites and blocks client queries outside admin access', async () => {
    users.next([]); await open(0);
    expect(component.detailRows).toEqual([]); expect(component.detailTotal).toBe(0);
    expect(auth.getCardsOfAUserForMonth).not.toHaveBeenCalled();
    component.closeDetails(); auth.isAdmin = false; component.openDetails(0);
    expect(component.isDetailsOpen).toBeFalse();
  });

  it('keeps a site-list failure visible instead of refreshing from a stale list', async () => {
    await open(0);
    users.error(new Error('denied'));
    await component.loadDetails(true);
    fixture.detectChanges();
    expect(component.detailsError).toContain('Impossible de charger les sites');
    expect(fixture.nativeElement.querySelector('[role="dialog"] table')).toBeNull();
    expect(auth.getCardsOfAUserForMonth.calls.count()).toBe(2);
  });

  it('traps focus, closes on Escape/backdrop, and restores scroll and focus', fakeAsync(() => {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]');
    const overflow = document.body.style.overflow;
    trigger.focus(); trigger.click(); flushMicrotasks(); fixture.detectChanges(); tick();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    const first: HTMLButtonElement = dialog.querySelector('button');
    const buttons = dialog.querySelectorAll('button'); const last: HTMLButtonElement = buttons[buttons.length - 1];
    expect(document.activeElement).toBe(first); expect(document.body.style.overflow).toBe('hidden');
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(component.isDetailsOpen).toBeFalse(); expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe(overflow);
    trigger.click(); flushMicrotasks(); fixture.detectChanges(); tick();
    const reopened = fixture.nativeElement.querySelector('[role="dialog"]');
    reopened.click(); expect(component.isDetailsOpen).toBeTrue();
    reopened.parentElement.click(); expect(component.isDetailsOpen).toBeFalse();
  }));
});
