import { fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { RequestUpdateComponent } from './request-update.component';

describe('RequestUpdateComponent', () => {
  let component: RequestUpdateComponent;
  let client: Client;
  let data: {
    numbersValid: jasmine.Spy;
    registerClientRequestUpdate: jasmine.Spy;
    updateUserInfoForRegisterClientRequestUpdate: jasmine.Spy;
  };

  beforeEach(() => {
    client = Object.assign(new Client(), {
      uid: 'client-1',
      firstName: 'Jean',
      lastName: 'Mukendi',
      phoneNumber: '081 111 1111',
      previousPhoneNumbers: ['0700000000'],
    });
    data = {
      numbersValid: jasmine.createSpy('numbersValid').and.returnValue(true),
      registerClientRequestUpdate: jasmine
        .createSpy('registerClientRequestUpdate')
        .and.resolveTo(undefined),
      updateUserInfoForRegisterClientRequestUpdate: jasmine
        .createSpy('updateUserInfoForRegisterClientRequestUpdate')
        .and.resolveTo(undefined),
    };

    component = new RequestUpdateComponent(
      {
        isAdmin: true,
        isAuditTeamViewer: false,
        getAllClients: () => of([client]),
        getAllEmployees: () => of([]),
      } as any,
      {
        snapshot: { paramMap: { get: () => '0' } },
      } as any,
      data as any,
      { navigate: jasmine.createSpy('navigate') } as any,
      {
        validateDateWithInOneWeekNotPastOrTodayCard: () => true,
        todaysDateMonthDayYear: () => '8-12-2026',
        todaysDate: () => '8-12-2026',
        convertDateToMonthDayYear: (value: string) => value,
      } as any,
      {} as any
    );
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the old phone in history when a register request changes it', fakeAsync(() => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.client.phoneNumber = '0999999999';

    component.registerClientNewDebtCycle();
    tick();

    expect(data.registerClientRequestUpdate).toHaveBeenCalled();
    const savedClient = data.registerClientRequestUpdate.calls.mostRecent()
      .args[0] as Client;
    expect(savedClient.phoneNumber).toBe('0999999999');
    expect(savedClient.previousPhoneNumbers).toEqual([
      '0700000000',
      '081 111 1111',
    ]);
  }));

  it('does not duplicate an old phone that is already in history', fakeAsync(() => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.client.previousPhoneNumbers = ['081-111-1111'];
    component.client.phoneNumber = '0999999999';

    component.registerClientNewDebtCycle();
    tick();

    const savedClient = data.registerClientRequestUpdate.calls.mostRecent()
      .args[0] as Client;
    expect(savedClient.previousPhoneNumbers).toEqual(['081-111-1111']);
  }));
});
