import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

type PeriodMode = 'month' | 'year';

interface OtherExpenseEntry {
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
  selector: 'app-gestion-other-expenses',
  templateUrl: './gestion-other-expenses.component.html',
  styleUrls: ['./gestion-other-expenses.component.css'],
})
export class GestionOtherExpensesComponent {
  otherExpenseAmount = '';
  otherExpenseReason = '';
  otherExpenses: Record<string, string> = {};
  allOtherExpenseEntries: OtherExpenseEntry[] = [];
  filteredOtherExpenseEntries: OtherExpenseEntry[] = [];
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

  showAllOtherExpenses = false;
  deletingOtherExpenseKey: string | null = null;
  showDeleteOtherExpenseModal = false;
  pendingDeleteOtherExpense: {
    key: string;
    amount: number;
    reason: string;
    dateLabel: string;
  } | null = null;
  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';
  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.getCurrentOtherExpenses();
    });
  }

  get periodLabel(): string {
    if (this.periodMode === 'year') {
      return `${this.selectedYear}`;
    }
    return `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  get visibleOtherExpenseEntries(): OtherExpenseEntry[] {
    return this.showAllOtherExpenses
      ? this.filteredOtherExpenseEntries
      : this.filteredOtherExpenseEntries.slice(0, 3);
  }

  toUsd(amountFC: number | string): number {
    const fc = Number(amountFC) || 0;
    const converted = this.compute.convertCongoleseFrancToUsDollars(
      fc.toString()
    );
    return Number(converted) || 0;
  }

  async addOtherExpense(): Promise<void> {
    if (!this.auth.isAdmin) return;

    if (this.otherExpenseAmount === '' || this.otherExpenseReason === '') {
      alert('Fill all fields!');
      return;
    }
    if (isNaN(Number(this.otherExpenseAmount))) {
      alert('Enter a valid number!');
      return;
    }

    const amount = Math.trunc(Number(this.otherExpenseAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Entrez un montant positif en FC.');
      return;
    }

    const reason = this.otherExpenseReason.trim();
    const conf = confirm(
      `Ajouter ${amount} FC dans les autres dépenses pour "${reason}" ?`
    );
    if (!conf) return;

    try {
      const dateKey = this.time.todaysDate();
      await this.data.addManagementOtherExpense(amount.toString(), reason, dateKey);
      this.managementInfo = {
        ...(this.managementInfo || {}),
        otherExpenses: {
          ...(this.managementInfo?.otherExpenses || {}),
          [dateKey]: `${amount}:${reason}`,
        },
      };
      this.otherExpenseAmount = '';
      this.otherExpenseReason = '';
      this.getCurrentOtherExpenses();
      this.showFeedback('Autre dépense enregistrée.', 'success');
    } catch (err: any) {
      this.showFeedback(
        `L'ajout de l'autre dépense a échoué: ${
          err?.message || 'Erreur inconnue'
        }`,
        'error'
      );
    }
  }

  getCurrentOtherExpenses(): void {
    this.otherExpenses = this.managementInfo?.otherExpenses || {};
    const sortedEntries = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.otherExpenses)
    );

    this.allOtherExpenseEntries = sortedEntries.map(([key, value]) => {
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

  setPeriodMode(mode: PeriodMode): void {
    if (this.periodMode === mode) return;
    this.periodMode = mode;
    this.showAllOtherExpenses = false;
    this.applyPeriodFilter();
  }

  onMonthChange(month: string): void {
    this.selectedMonth = Number(month);
    this.showAllOtherExpenses = false;
    this.applyPeriodFilter();
  }

  onYearChange(year: string): void {
    this.selectedYear = Number(year);
    this.showAllOtherExpenses = false;
    this.applyPeriodFilter();
  }

  hasMoreOtherExpenses(): boolean {
    return this.filteredOtherExpenseEntries.length > 3;
  }

  openDeleteOtherExpenseModal(entryKey: string, event: Event): void {
    event.stopPropagation();
    if (!this.auth.isAdmin || this.deletingOtherExpenseKey) return;

    const entry = this.allOtherExpenseEntries.find(
      (item) => item.key === entryKey
    );
    if (!entry) return;

    this.pendingDeleteOtherExpense = {
      key: entry.key,
      amount: entry.amount,
      reason: entry.reason,
      dateLabel: entry.dateLabel,
    };
    this.showDeleteOtherExpenseModal = true;
  }

  closeDeleteOtherExpenseModal(): void {
    if (this.deletingOtherExpenseKey) return;
    this.showDeleteOtherExpenseModal = false;
    this.pendingDeleteOtherExpense = null;
  }

  async confirmDeleteOtherExpense(): Promise<void> {
    const pending = this.pendingDeleteOtherExpense;
    if (!pending) return;

    try {
      this.deletingOtherExpenseKey = pending.key;
      await this.data.deleteManagementOtherExpenseEntry(pending.key);
      const nextOtherExpenses = { ...(this.managementInfo?.otherExpenses || {}) };
      delete nextOtherExpenses[pending.key];
      this.managementInfo = {
        ...(this.managementInfo || {}),
        otherExpenses: nextOtherExpenses,
      };
      this.getCurrentOtherExpenses();
      this.showFeedback('Autre dépense supprimée.', 'success');
    } catch (err: any) {
      this.showFeedback(
        `La suppression de l'autre dépense a échoué: ${
          err?.message || 'Erreur inconnue'
        }`,
        'error'
      );
    } finally {
      this.deletingOtherExpenseKey = null;
      this.closeDeleteOtherExpenseModal();
    }
  }

  backToMonth(): void {
    this.router.navigate(['/gestion-month']);
  }

  private applyPeriodFilter(): void {
    const base = this.allOtherExpenseEntries.filter((entry) => {
      if (entry.year !== this.selectedYear) return false;
      if (this.periodMode === 'month' && entry.month !== this.selectedMonth) {
        return false;
      }
      return true;
    });

    this.filteredOtherExpenseEntries = [...base].sort(
      (a, b) => b.timestamp - a.timestamp
    );
    this.periodTotal = this.filteredOtherExpenseEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
  }

  private buildAvailableYears(): void {
    const years = new Set<number>([new Date().getFullYear(), this.selectedYear]);
    this.allOtherExpenseEntries.forEach((entry) => years.add(entry.year));
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
}
