import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
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

  showPlanned = false; // controls collapse
  showAllExpenses = false; // controls expense list expansion
  deletingExpenseKey: string | null = null;
  showDeleteExpenseModal = false;
  pendingDeleteExpense: {
    key: string;
    amount: number;
    reason: string;
    dateLabel: string;
  } | null = null;
  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';
  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  budgetCurrent: [string, string][] = [];
  budgetAmounts: string[] = [];
  budgetReasons: string[] = [];
  budgetDates: string[] = [];
  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.currentUser = this.auth.currentUser;
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.getCurrentExpense();
      this.getPlannedExpense(); // planned list
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
    this.expenses = this.managementInfo?.expenses || {};
    this.currentExpenses = Object.entries(this.expenses);
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
  /** planned-expense list */
  getPlannedExpense() {
    const map = this.managementInfo?.budgetedExpenses || {};
    this.budgetCurrent = Object.entries(map);
    this.budgetCurrent = this.compute.sortArrayByDateDescendingOrder(
      this.budgetCurrent
    );

    const rawList = this.budgetCurrent.map((entry) => entry[1]);

    this.budgetAmounts = rawList.map((item) => item.split(':')[0]);
    this.budgetReasons = rawList.map((item) => item.split(':')[1] || '');
    this.budgetDates = this.budgetCurrent.map((entry) =>
      this.time.convertTimeFormat(entry[0])
    );
  }

  hasMoreExpenses(): boolean {
    return this.currentExpenses.length > 3;
  }

  openDeleteExpenseModal(entryKey: string, event: Event): void {
    event.stopPropagation();
    if (!this.auth.isAdmin) return;
    if (this.deletingExpenseKey) return;

    const entryValue = this.expenses?.[entryKey];
    if (!entryValue) return;

    const amount = Number(String(entryValue).split(':')[0]) || 0;
    const reason = String(entryValue).split(':')[1] || 'Sans raison';
    const formattedDate = this.time.convertTimeFormat(entryKey);
    this.pendingDeleteExpense = {
      key: entryKey,
      amount,
      reason,
      dateLabel: formattedDate,
    };
    this.showDeleteExpenseModal = true;
  }

  closeDeleteExpenseModal(): void {
    if (this.deletingExpenseKey) return;
    this.showDeleteExpenseModal = false;
    this.pendingDeleteExpense = null;
  }

  private showFeedback(message: string, type: 'success' | 'error'): void {
    this.feedbackMessage = message;
    this.feedbackType = type;
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
    this.feedbackTimeout = setTimeout(() => {
      this.feedbackMessage = '';
      this.feedbackTimeout = null;
    }, 3500);
  }

  async confirmDeleteExpense(
    choice: 'deleteOnly' | 'deleteAndDeduct'
  ): Promise<void> {
    const pending = this.pendingDeleteExpense;
    if (!pending) return;
    const shouldDeduct = choice === 'deleteAndDeduct';

    try {
      this.deletingExpenseKey = pending.key;
      await this.data.deleteManagementExpenseEntry(pending.key, shouldDeduct);
      const nextExpenses = { ...(this.managementInfo?.expenses || {}) };
      delete nextExpenses[pending.key];
      this.managementInfo = {
        ...(this.managementInfo || {}),
        expenses: nextExpenses,
        moneyInHands: shouldDeduct
          ? (
              Number(this.managementInfo?.moneyInHands || 0) -
              Number(pending.amount)
            ).toString()
          : this.managementInfo?.moneyInHands,
      };
      this.getCurrentExpense();
      this.showFeedback(
        shouldDeduct
          ? 'Dépense supprimée et montant déduit de moneyInHands.'
          : 'Dépense supprimée sans déduction de moneyInHands.',
        'success'
      );
    } catch (err: any) {
      this.showFeedback(
        `La suppression de la dépense a échoué: ${err?.message || 'Erreur inconnue'}`,
        'error'
      );
    } finally {
      this.deletingExpenseKey = null;
      this.closeDeleteExpenseModal();
    }
  }
}
