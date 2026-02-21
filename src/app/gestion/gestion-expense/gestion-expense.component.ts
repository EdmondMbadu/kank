import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

type PeriodMode = 'month' | 'year';

interface ExpenseEntry {
  key: string;
  rawValue: string;
  amount: number;
  reason: string;
  dateLabel: string;
  month: number;
  year: number;
  timestamp: number;
}

@Component({
  selector: 'app-gestion-expense',
  templateUrl: './gestion-expense.component.html',
  styleUrls: ['./gestion-expense.component.css'],
})
export class GestionExpenseComponent {
  expenseAmount: string = '';
  expenseReason: string = '';
  expenses: Record<string, string> = {};
  allExpenseEntries: ExpenseEntry[] = [];
  filteredExpenseEntries: ExpenseEntry[] = [];
  currentUser: any = {};
  managementInfo?: Management = {};

  periodMode: PeriodMode = 'month';
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  availableYears: number[] = [];
  periodTotal = 0;
  readonly monthNames = [
    'Janvier',
    'Fevrier',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Aout',
    'Septembre',
    'Octobre',
    'Novembre',
    'Decembre',
  ];

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

  get periodLabel(): string {
    if (this.periodMode === 'year') {
      return `${this.selectedYear}`;
    }
    return `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  toUsd(amountFC: number | string): number {
    const fc = Number(amountFC) || 0;
    const converted = this.compute.convertCongoleseFrancToUsDollars(
      fc.toString()
    );
    return Number(converted) || 0;
  }

  get visibleExpenseEntries(): ExpenseEntry[] {
    return this.showAllExpenses
      ? this.filteredExpenseEntries
      : this.filteredExpenseEntries.slice(0, 3);
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
    const sortedEntries = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.expenses)
    );

    this.allExpenseEntries = sortedEntries.map(([key, value]) => {
      const parsed = this.parseExpenseValue(value);
      const dateParts = this.parseDateKey(key);
      return {
        key,
        rawValue: value,
        amount: parsed.amount,
        reason: parsed.reason || 'Sans raison',
        dateLabel: this.time.convertTimeFormat(key),
        month: dateParts.month,
        year: dateParts.year,
        timestamp: dateParts.timestamp,
      };
    });

    this.buildAvailableYears();
    this.applyPeriodFilter();
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

  setPeriodMode(mode: PeriodMode): void {
    if (this.periodMode === mode) return;
    this.periodMode = mode;
    this.showAllExpenses = false;
    this.applyPeriodFilter();
  }

  onMonthChange(month: string): void {
    this.selectedMonth = Number(month);
    this.showAllExpenses = false;
    this.applyPeriodFilter();
  }

  onYearChange(year: string): void {
    this.selectedYear = Number(year);
    this.showAllExpenses = false;
    this.applyPeriodFilter();
  }

  private applyPeriodFilter(): void {
    const base = this.allExpenseEntries.filter((entry) => {
      if (entry.year !== this.selectedYear) return false;
      if (this.periodMode === 'month' && entry.month !== this.selectedMonth) {
        return false;
      }
      return true;
    });

    this.filteredExpenseEntries = [...base].sort(
      (a, b) => b.timestamp - a.timestamp
    );
    this.periodTotal = this.filteredExpenseEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
  }

  private buildAvailableYears(): void {
    const years = new Set<number>([new Date().getFullYear(), this.selectedYear]);
    this.allExpenseEntries.forEach((entry) => years.add(entry.year));
    this.availableYears = Array.from(years).sort((a, b) => b - a);
    if (!years.has(this.selectedYear) && this.availableYears.length) {
      this.selectedYear = this.availableYears[0];
    }
  }

  private parseExpenseValue(raw: string): { amount: number; reason: string } {
    const idx = String(raw).indexOf(':');
    if (idx < 0) {
      return {
        amount: Number(raw) || 0,
        reason: '',
      };
    }
    const amountPart = String(raw).slice(0, idx);
    const reasonPart = String(raw).slice(idx + 1).trim();
    return {
      amount: Number(amountPart) || 0,
      reason: reasonPart,
    };
  }

  private parseDateKey(key: string): {
    month: number;
    year: number;
    timestamp: number;
  } {
    const parsed = this.time.parseFlexibleDateTime(key);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        month: parsed.getMonth() + 1,
        year: parsed.getFullYear(),
        timestamp: parsed.getTime(),
      };
    }

    const fallback = new Date();
    return {
      month: fallback.getMonth() + 1,
      year: fallback.getFullYear(),
      timestamp: 0,
    };
  }

  hasMoreExpenses(): boolean {
    return this.filteredExpenseEntries.length > 3;
  }

  openDeleteExpenseModal(entryKey: string, event: Event): void {
    event.stopPropagation();
    if (!this.auth.isAdmin) return;
    if (this.deletingExpenseKey) return;

    const entry = this.allExpenseEntries.find((item) => item.key === entryKey);
    if (!entry) return;

    this.pendingDeleteExpense = {
      key: entryKey,
      amount: entry.amount,
      reason: entry.reason,
      dateLabel: entry.dateLabel,
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
