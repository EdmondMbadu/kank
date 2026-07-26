import { of } from 'rxjs';
import { GestionExpenseComponent } from './gestion-expense.component';

describe('GestionExpenseComponent confirmed saves', () => {
  let component: GestionExpenseComponent;
  let data: jasmine.SpyObj<any>;
  let router: jasmine.SpyObj<any>;

  beforeEach(() => {
    spyOn(window, 'confirm').and.returnValue(true);

    data = jasmine.createSpyObj('DataService', [
      'updateManagementInfoForAddExpense',
      'deleteManagementExpenseEntry',
      'deleteManagementBudgetedExpenseEntry',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));

    const auth = {
      currentUser: { firstName: 'Audit' },
      managementInfo: { id: 'management-1', moneyInHands: '1000000' },
      getManagementInfo: () =>
        of([
          {
            id: 'management-1',
            moneyInHands: '1000000',
            expenses: {},
            budgetedExpenses: {},
          },
        ]),
    };
    const compute = {
      sortArrayByDateDescendingOrder: (entries: any[]) => entries,
      convertCongoleseFrancToUsDollars: (amount: string) => amount,
    };
    const time = {
      convertTimeFormat: (value: string) => value,
      parseFlexibleDateTime: (value: string) => new Date(value),
    };

    component = new GestionExpenseComponent(
      auth as any,
      data,
      router,
      compute as any,
      time as any
    );
    component.expenseAmount = '50000';
    component.expenseReason = 'Transport';
  });

  it('waits for Firestore before navigating', async () => {
    let confirmWrite!: () => void;
    data.updateManagementInfoForAddExpense.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );

    const savePromise = component.addExpense();

    expect(component.isSavingExpense).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();

    confirmWrite();
    await savePromise;

    expect(router.navigate).toHaveBeenCalledOnceWith(['/gestion-today']);
    expect(component.isSavingExpense).toBeFalse();
  });

  it('keeps the form open and reports a rejected write', async () => {
    data.updateManagementInfoForAddExpense.and.returnValue(
      Promise.reject(new Error('permission-denied'))
    );

    await component.addExpense();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.feedbackType).toBe('error');
    expect(component.feedbackMessage).toContain('permission-denied');
    expect(component.expenseAmount).toBe('50000');
    expect(component.expenseReason).toBe('Transport');
    expect(component.isSavingExpense).toBeFalse();
  });

  it('ignores a second submission while the first is pending', async () => {
    let confirmWrite!: () => void;
    data.updateManagementInfoForAddExpense.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );

    const firstSave = component.addExpense();
    await component.addExpense();

    expect(data.updateManagementInfoForAddExpense).toHaveBeenCalledTimes(1);

    confirmWrite();
    await firstSave;
  });
});
