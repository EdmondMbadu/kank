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
