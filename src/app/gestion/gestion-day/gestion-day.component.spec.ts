import { GestionDayComponent } from './gestion-day.component';

describe('GestionDayComponent confirmed planned-expense saves', () => {
  let component: GestionDayComponent;
  let data: jasmine.SpyObj<any>;

  beforeEach(() => {
    spyOn(window, 'alert');
    spyOn(console, 'error');

    data = jasmine.createSpyObj('DataService', [
      'addBudgetPlannedExpense',
    ]);
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const auth = {
      isAdmin: true,
      currentUser: { firstName: 'Audit' },
      managementInfo: { id: 'management-1' },
    };
    const time = {
      getTodaysDateYearMonthDay: () => '2026-07-25',
      todaysDateMonthDayYear: () => '7-25-2026',
      yesterdaysDateMonthDayYear: () => '7-24-2026',
      getTomorrowsDateMonthDayYear: () => '7-26-2026',
      convertDateToDayMonthYear: (date: string) => date,
    };
    const compute = {
      convertUsDollarsToCongoleseFranc: (amount: string) =>
        (Number(amount) * 2800).toString(),
    };

    component = new GestionDayComponent(
      router,
      auth as any,
      time as any,
      compute as any,
      data,
      {} as any
    );
    component.showBudgetModal = true;
    component.budgetInput = 50;
    component.budgetReason = 'Transport';
  });

  it('blocks duplicate planned-expense writes until confirmation', async () => {
    let confirmWrite!: () => void;
    data.addBudgetPlannedExpense.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );
    spyOn(component, 'initalizeInputs');

    const firstSave = component.saveBudgetedExpense();
    await component.saveBudgetedExpense();

    expect(component.isSavingBudgetedExpense).toBeTrue();
    expect(data.addBudgetPlannedExpense).toHaveBeenCalledTimes(1);
    expect(component.showBudgetModal).toBeTrue();

    confirmWrite();
    await firstSave;

    expect(component.showBudgetModal).toBeFalse();
    expect(component.initalizeInputs).toHaveBeenCalled();
    expect(component.isSavingBudgetedExpense).toBeFalse();
  });

  it('keeps the modal and values open after rejection', async () => {
    data.addBudgetPlannedExpense.and.returnValue(
      Promise.reject(new Error('offline'))
    );

    await component.saveBudgetedExpense();

    expect(component.showBudgetModal).toBeTrue();
    expect(component.budgetInput).toBe(50);
    expect(component.budgetReason).toBe('Transport');
    expect(component.isSavingBudgetedExpense).toBeFalse();
    expect(window.alert).toHaveBeenCalledWith(
      "Impossible d'enregistrer cette dépense planifiée."
    );
  });
});

describe('GestionDayComponent weekly payment history', () => {
  function createComponent(isAdmin = true): GestionDayComponent {
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const auth = {
      isAdmin,
      currentUser: { firstName: 'Admin' },
      managementInfo: { id: 'management-1' },
    };
    const time = {
      getTodaysDateYearMonthDay: () => '2026-07-26',
      todaysDateMonthDayYear: () => '7-26-2026',
      yesterdaysDateMonthDayYear: () => '7-25-2026',
      getTomorrowsDateMonthDayYear: () => '7-27-2026',
      convertDateToDayMonthYear: (date: string) => date,
      convertDateToMonthDayYear: (date: string) => {
        const [year, month, day] = date.split('-');
        return `${Number(month)}-${Number(day)}-${year}`;
      },
      toDate: (date: string) => {
        const [month, day, year] = date.split('-').map(Number);
        return new Date(year, month - 1, day);
      },
    };
    const compute = {
      convertCongoleseFrancToUsDollars: (amount: string) =>
        (Number(amount) / 3000).toString(),
    };

    return new GestionDayComponent(
      router,
      auth as any,
      time as any,
      compute as any,
      {} as any,
      {} as any
    );
  }

  it('aggregates every team by Monday-to-Sunday week and preserves zero weeks', () => {
    const component = createComponent();
    component.weeklyPaymentDateCorrectFormat = '7-26-2026';
    component.allUsers = [
      {
        firstName: 'Pumbu',
        dailyReimbursement: {
          '7-6-2026': '100000',
          '7-7-2026': '50000',
          '7-20-2026': '200000',
        },
      },
      {
        firstName: 'Matadikibala',
        dailyReimbursement: {
          '7-8-2026': '25000',
          '7-26-2026': '300000',
          '7-40-2026': '999999',
          '8-3-2026': '999999',
        },
      },
    ];

    const points = (component as any).buildWeeklyPaymentHistory('1M');

    expect(points.map((point: any) => point.totalFc)).toEqual([
      0,
      0,
      175000,
      0,
      500000,
    ]);
    expect(
      points.map((point: any) => component['formatIsoDate'](point.weekStart))
    ).toEqual([
      '2026-06-22',
      '2026-06-29',
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
    ]);
  });

  it('does no history computation or chart mutation for non-admin viewers', () => {
    const component = createComponent(false);
    const initialGraph = component.graphWeeklyPayments;
    component.allUsers = [
      {
        firstName: 'Audit',
        dailyReimbursement: { '7-20-2026': '500000' },
      },
    ];

    component.updateWeeklyPaymentHistory('1A');

    expect(component.weeklyPaymentHistoryRange).toBe('1M');
    expect(component.graphWeeklyPayments).toBe(initialGraph);
    expect(
      (component as any).buildWeeklyPaymentHistory('1M')
    ).toEqual([]);
  });

  it('builds a dual-currency weekly graph and marks the current week partial', () => {
    const component = createComponent();
    component.weeklyPaymentDateCorrectFormat = '7-26-2026';
    component.allUsers = [
      {
        firstName: 'Pumbu',
        dailyReimbursement: {
          '7-13-2026': '300000',
          '7-20-2026': '600000',
        },
      },
    ];

    component.updateWeeklyPaymentHistory('1M');

    expect(component.weeklyPaymentHistoryIncludesCurrentWeek).toBeTrue();
    expect(component.graphWeeklyPayments.data).toHaveSize(1);
    expect(component.graphWeeklyPayments.data[0].y.slice(-2)).toEqual([
      100,
      200,
    ]);
    expect(
      component.graphWeeklyPayments.data[0].customdata.slice(-1)[0]
    ).toEqual([
      600000,
      'Semaine du 20/07/2026 au 26/07/2026',
      '<br><i>Semaine en cours (partielle)</i>',
    ]);
  });
});
