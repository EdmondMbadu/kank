import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.css'],
})
export class ExpensesComponent {
  expenseAmount: string = '';
  expenseReason: string = '';
  expenses: string[] = [];
  currentExpenses: [string, string][] = [];
  expensesAmounts: string[] = [];
  expensesReasons: string[] = [];
  expensesDates: string[] = [];
  currentUser: any = {};
  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.getCurrentUser();
  }

  addExpense() {
    if (this.expenseAmount === '' || this.expenseReason === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.expenseAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      this.data.updateUserInfoForAddExpense(
        this.expenseAmount,
        this.expenseReason
      );
      this.router.navigate(['/home']);
    }
  }
  getCurrentUser() {
    this.auth.user$.subscribe((user) => {
      this.currentUser = user;
      this.expenses = this.currentUser.expenses;
      this.currentExpenses = Object.entries(this.currentUser.expenses);
      this.currentExpenses = this.compute.sortArrayByDateDescendingOrder(
        this.currentExpenses
      );

      this.expensesReasons = this.currentExpenses.map((entry) => entry[1]);
      this.expensesDates = this.currentExpenses.map((entry) =>
        this.time.convertTimeFormat(entry[0])
      );
      this.expensesAmounts = this.expensesReasons.map(
        (item) => item.split(':')[0]
      );
      this.expensesReasons = this.expensesReasons.map(
        (item) => item.split(':')[1]
      );
    });
  }
}
