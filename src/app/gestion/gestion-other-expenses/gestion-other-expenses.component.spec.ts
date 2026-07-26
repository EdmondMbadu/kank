import { of } from 'rxjs';
import { GestionOtherExpensesComponent } from './gestion-other-expenses.component';

describe('GestionOtherExpensesComponent confirmed saves', () => {
  let component: GestionOtherExpensesComponent;
  let data: jasmine.SpyObj<any>;

  beforeEach(() => {
    spyOn(window, 'confirm').and.returnValue(true);

    data = jasmine.createSpyObj('DataService', [
      'addManagementOtherExpense',
      'deleteManagementOtherExpenseEntry',
    ]);
    const auth = {
      currentUser: { firstName: 'Admin' },
      isAdmin: true,
      getManagementInfo: () =>
        of([{ id: 'management-1', otherExpenses: {} }]),
    };
    const router = jasmine.createSpyObj('Router', ['navigate']);
    const compute = {
      sortArrayByDateDescendingOrder: (entries: any[]) => entries,
      convertCongoleseFrancToUsDollars: (amount: string) => amount,
    };
    const time = {
      todaysDate: () => '7-25-2026-12-0-0',
      convertTimeFormat: (value: string) => value,
      parseFlexibleDateTime: (value: string) => new Date(value),
    };

    component = new GestionOtherExpensesComponent(
      auth as any,
      data,
      router,
      compute as any,
      time as any
    );
    component.otherExpenseAmount = '75000';
    component.otherExpenseReason = 'Transport';
  });

  it('prevents duplicate other-expense writes', async () => {
    let confirmWrite!: () => void;
    data.addManagementOtherExpense.and.returnValue(
      new Promise<void>((resolve) => {
        confirmWrite = resolve;
      })
    );

    const firstSave = component.addOtherExpense();
    await component.addOtherExpense();

    expect(component.isSavingOtherExpense).toBeTrue();
    expect(data.addManagementOtherExpense).toHaveBeenCalledTimes(1);

    confirmWrite();
    await firstSave;

    expect(component.otherExpenseAmount).toBe('');
    expect(component.isSavingOtherExpense).toBeFalse();
  });

  it('retains values after a rejected write', async () => {
    data.addManagementOtherExpense.and.returnValue(
      Promise.reject(new Error('write-failed'))
    );

    await component.addOtherExpense();

    expect(component.otherExpenseAmount).toBe('75000');
    expect(component.otherExpenseReason).toBe('Transport');
    expect(component.feedbackType).toBe('error');
    expect(component.isSavingOtherExpense).toBeFalse();
  });
});
