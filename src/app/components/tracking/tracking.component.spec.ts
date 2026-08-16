import { Client } from 'src/app/models/client';
import { TrackingComponent } from './tracking.component';

describe('TrackingComponent', () => {
  it('should create', () => {
    const component = new TrackingComponent(
      {} as any,
      { currentUser: {} } as any,
      { todaysDateMonthDayYear: () => '7-25-2026' } as any,
      {} as any,
      {} as any,
      {} as any
    );

    expect(component).toBeTruthy();
  });

  it('shows the pending total derived from active requests and excludes score 70+', () => {
    const component = new TrackingComponent(
      {} as any,
      {
        currentUser: {
          monthBudget: '1000000',
          monthBudgetPending: 'NaN',
        },
        isAdmninistrator: true,
      } as any,
      { todaysDateMonthDayYear: () => '8-16-2026' } as any,
      {
        convertUsDollarsToCongoleseFranc: (value: string) => value,
        convertCongoleseFrancToUsDollars: (value: string) => value,
      } as any,
      {
        generalMaxNumberOfClients: 70,
        generalMaxNumberOfDaysToLend: 20,
      } as any,
      {} as any
    );
    component.clients = [
      Object.assign(new Client(), {
        requestStatus: 'pending',
        requestType: 'lending',
        requestAmount: '120000',
        creditScore: '60',
      }),
      Object.assign(new Client(), {
        requestStatus: 'pending',
        requestType: 'lending',
        requestAmount: '900000',
        creditScore: '70',
      }),
    ];

    component.initalizeInputs();

    expect(component.amountBudgetPending).toBe('120000');
    expect(component.summaryContent[3]).toBe(120000);
  });
});
