import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.css'],
})
export class ExpensesComponent {
  expenseAmount: string = '';
  expenseReason: string = '';
  expenses: string[] = [];
  expensesAmounts: string[] = [];
  expensesReasons: string[] = [];
  expensesDates: string[] = [];
  currentUser: any = {};
  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router
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
      this.getExpensesData();
    });
  }
  getExpensesData() {
    for (const key in this.expenses) {
      this.expensesDates.push(key);
      let current = this.expenses[key].split(':');
      this.expensesAmounts.push(current[0]);
      this.expensesReasons.push(current[1]);
    }
  }
}
