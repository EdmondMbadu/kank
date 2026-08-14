import { of } from 'rxjs';
import { TodayCentralComponent } from './today-central.component';

describe('TodayCentralComponent management hydration', () => {
  it('accepts the compatibility stream without changing the page contract', () => {
    const management = { id: 'management-1', reserve: { old: '10' } };
    const auth = {
      getManagementInfo: () => of([management]),
      getAllUsersInfo: () => of([]),
    };
    const time = {
      getTomorrowsDateMonthDayYear: () => '8-15-2026',
      todaysDateMonthDayYear: () => '8-14-2026',
      convertDateToDayMonthYear: (value: string) => value,
      getTodaysDateYearMonthDay: () => '2026-08-14',
    };
    const component = new TodayCentralComponent(
      {} as any,
      auth as any,
      time as any,
      {} as any,
      {} as any
    );
    spyOn(component, 'initalizeInputs');
    spyOn<any>(component, 'loadAuditPaymentPerformance');

    component.ngOnInit();

    expect(component.managementInfo).toBe(management as any);
    expect(component.allUsers).toEqual([]);
    expect(component.initalizeInputs).toHaveBeenCalled();
  });
});
