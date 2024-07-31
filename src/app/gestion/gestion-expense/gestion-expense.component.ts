import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-expense',
  templateUrl: './gestion-expense.component.html',
  styleUrls: ['./gestion-expense.component.css'],
})
export class GestionExpenseComponent {
  expenseAmount: string = '';
  expenseReason: string = '';
  expenses: any = [];
  currentExpenses: [string, string][] = [];
  expensesAmounts: string[] = [];
  expensesReasons: string[] = [];
  expensesDates: string[] = [];
  currentUser: any = {};
  managementInfo?: Management = {};
  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.getCurrentExpense();
    });
  }

  addExpense() {
    if (this.expenseAmount === '' || this.expenseReason === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.expenseAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      let conf = confirm(
        ` Vous ajouter dans la depense ${this.expenseAmount} FC pour la  raison de ${this.expenseReason}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.data.updateManagementInfoForAddExpense(
        this.expenseAmount,
        this.expenseReason
      );
      this.router.navigate(['/gestion-today']);
    }
  }
  getCurrentExpense() {
    this.expenses = this.managementInfo?.expenses;
    this.currentExpenses = Object.entries(this.managementInfo?.expenses!);
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
  }
}
