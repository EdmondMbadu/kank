import { fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { Client } from 'src/app/models/client';
import { WithdrawSavingsComponent } from './withdraw-savings.component';

describe('WithdrawSavingsComponent payment completion', () => {
  function create() {
    const client: Client = {uid: 'client', amountToPay: '560000', amountPaid: '430000',
      debtLeft: '130000', savings: '150000', paymentPeriodRange: '8',
      debtCycleStartDate: '8-13-2026', numberOfPaymentsMade: '11', creditScore: '70'};
    const clients = new BehaviorSubject<Client[]>([client]);
    const auth = {currentUser: {uid: 'site', clientsSavings: '150000', totalDebtLeft: '130000'},
      getAllClients: () => clients};
    const navigate = jasmine.createSpy('navigate');
    const performance = {updateUserPerformance: jasmine.createSpy('performance')};
    const writes: Array<{path: string; value: any}> = [];
    const runTransaction = jasmine.createSpy('transaction').and.callFake(async (callback: any) => {
      callback({set: (path: string, value: any) => writes.push({path, value})});
      clients.next([{...client, amountToPay: '0', debtLeft: '0'}]);
    });
    const withdraw = jasmine.createSpy('withdraw').and.resolveTo();
    const component = new WithdrawSavingsComponent({navigate} as any, auth as any, {
      clientWithdrawFromSavings: withdraw, computeDailySavingReturn: () => '130000',
      computeDailySaving: () => '0', computeDailyReimbursement: () => '130000',
      computeDailySavingsToPayment: () => '130000',
    } as any, {snapshot: {paramMap: {get: () => '0'}}} as any, {
      todaysDate: () => '11-3-2026-13-38-34', todaysDateMonthDayYear: () => '11-3-2026',
      weeksSince: () => 12,
    } as any, {firestore: {runTransaction}, doc: (path: string) => ({ref: path})} as any, performance as any);
    component.ngOnInit();
    component.savingsWithdrawn = '130000';
    spyOn(component, 'computeCreditScore').and.returnValue('75');
    spyOn(window, 'confirm').and.returnValue(true);
    return {component, clients, client, performance, navigate, runTransaction, withdraw, writes};
  }

  it('keeps the submitted loan and amount after a transfer clears the debt and refreshes the client', fakeAsync(() => {
    const {component, performance, navigate, runTransaction, writes} = create();
    component.withDrawSavings(); tick();
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(writes[0].path).toBe('users/site/clients/client');
    expect(writes[0].value).toEqual(jasmine.objectContaining({
      debtLeft: '0', amountPaid: '560000', savings: '20000',
      payments: {'11-3-2026-13-38-34': '130000'},
    }));
    expect(performance.updateUserPerformance).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      uid: 'client', amountToPay: '560000', paymentPeriodRange: '8', debtCycleStartDate: '8-13-2026',
    }), '130000');
    expect(navigate).toHaveBeenCalledOnceWith(['/client-portal', '0']);
  }));

  it('does not wait for performance after saving a transfer', fakeAsync(() => {
    const {component, performance, navigate} = create();
    performance.updateUserPerformance.and.returnValue(new Promise(() => {}));
    component.withDrawSavings(); tick();
    expect(navigate).toHaveBeenCalledOnceWith(['/client-portal', '0']);
  }));

  it('keeps successful transfer navigation when performance throws', fakeAsync(() => {
    const {component, performance, navigate} = create();
    performance.updateUserPerformance.and.throwError('points unavailable');
    spyOn(console, 'error');
    component.withDrawSavings(); tick();
    expect(navigate).toHaveBeenCalledOnceWith(['/client-portal', '0']);
    expect(console.error).toHaveBeenCalled();
  }));

  it('does not award points for an ordinary withdrawal after the debt is cleared', fakeAsync(() => {
    const {component, client, clients, performance, runTransaction, withdraw} = create();
    clients.next([{...client, debtLeft: '0'}]);
    component.withDrawSavings(); tick();
    expect(withdraw).toHaveBeenCalledTimes(1);
    expect(runTransaction).not.toHaveBeenCalled();
    expect(performance.updateUserPerformance).not.toHaveBeenCalled();
  }));
});
