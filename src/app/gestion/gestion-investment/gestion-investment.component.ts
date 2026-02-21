import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

type PeriodMode = 'month' | 'year';

interface InvestmentEntry {
  key: string;
  amount: number;
  dateLabel: string;
  month: number;
  year: number;
  timestamp: number;
}

@Component({
  selector: 'app-gestion-investment',
  templateUrl: './gestion-investment.component.html',
  styleUrls: ['./gestion-investment.component.css'],
})
export class GestionInvestmentComponent {
  investmentAmount: string = '';
  investment: Record<string, string> = {};
  allInvestmentEntries: InvestmentEntry[] = [];
  filteredInvestmentEntries: InvestmentEntry[] = [];
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

  showAllInvestments = false;
  deletingInvestmentKey: string | null = null;
  showDeleteInvestmentModal = false;
  pendingDeleteInvestment: {
    key: string;
    amount: number;
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
    this.currentUser = this.auth.currentUser;
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.getCurrentInvestment();
    });
  }

  get periodLabel(): string {
    if (this.periodMode === 'year') {
      return `${this.selectedYear}`;
    }
    return `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  get visibleInvestmentEntries(): InvestmentEntry[] {
    return this.showAllInvestments
      ? this.filteredInvestmentEntries
      : this.filteredInvestmentEntries.slice(0, 3);
  }

  toUsd(amountFC: number | string): number {
    const fc = Number(amountFC) || 0;
    const converted = this.compute.convertCongoleseFrancToUsDollars(
      fc.toString()
    );
    return Number(converted) || 0;
  }

  async addToInvestment() {
    if (this.investmentAmount === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.investmentAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      let conf = confirm(
        ` Vous ajouter dans l'investissement ${this.investmentAmount} FC. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      try {
        const updateManagement =
          await this.data.updateManagementInfoForAddToInvestment(
            this.investmentAmount
          );
        this.router.navigate(['/gestion-today']);
      } catch (err: any) {
        alert("Une erreur s'est produite lors de l'initialization, Réessayez");

        return;
      }
    }
  }
  getCurrentInvestment() {
    this.investment = this.managementInfo?.investment || {};

    const sortedEntries = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.investment)
    );
    this.allInvestmentEntries = sortedEntries.map(([key, rawAmount]) => {
      const amount = Number(rawAmount) || 0;
      const dateParts = this.parseDateKey(key);
      return {
        key,
        amount,
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
    this.showAllInvestments = false;
    this.applyPeriodFilter();
  }

  onMonthChange(month: string): void {
    this.selectedMonth = Number(month);
    this.showAllInvestments = false;
    this.applyPeriodFilter();
  }

  onYearChange(year: string): void {
    this.selectedYear = Number(year);
    this.showAllInvestments = false;
    this.applyPeriodFilter();
  }

  private applyPeriodFilter(): void {
    const base = this.allInvestmentEntries.filter((entry) => {
      if (entry.year !== this.selectedYear) return false;
      if (this.periodMode === 'month' && entry.month !== this.selectedMonth) {
        return false;
      }
      return true;
    });

    this.filteredInvestmentEntries = [...base].sort(
      (a, b) => b.timestamp - a.timestamp
    );
    this.periodTotal = this.filteredInvestmentEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
  }

  private buildAvailableYears(): void {
    const years = new Set<number>([new Date().getFullYear(), this.selectedYear]);
    this.allInvestmentEntries.forEach((entry) => years.add(entry.year));
    this.availableYears = Array.from(years).sort((a, b) => b - a);
    if (!years.has(this.selectedYear) && this.availableYears.length) {
      this.selectedYear = this.availableYears[0];
    }
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

  hasMoreInvestments(): boolean {
    return this.filteredInvestmentEntries.length > 3;
  }

  openDeleteInvestmentModal(entryKey: string, event: Event): void {
    event.stopPropagation();
    if (!this.auth.isAdmin) return;
    if (this.deletingInvestmentKey) return;

    const entry = this.allInvestmentEntries.find((item) => item.key === entryKey);
    if (!entry) return;

    this.pendingDeleteInvestment = {
      key: entryKey,
      amount: entry.amount,
      dateLabel: entry.dateLabel,
    };
    this.showDeleteInvestmentModal = true;
  }

  closeDeleteInvestmentModal(): void {
    if (this.deletingInvestmentKey) return;
    this.showDeleteInvestmentModal = false;
    this.pendingDeleteInvestment = null;
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

  async confirmDeleteInvestment(
    choice: 'deleteOnly' | 'deleteAndDeduct'
  ): Promise<void> {
    const pending = this.pendingDeleteInvestment;
    if (!pending) return;
    const shouldDeduct = choice === 'deleteAndDeduct';

    try {
      this.deletingInvestmentKey = pending.key;
      await this.data.deleteManagementInvestmentEntry(
        pending.key,
        shouldDeduct
      );
      const nextInvestments = { ...(this.managementInfo?.investment || {}) };
      delete nextInvestments[pending.key];
      this.managementInfo = {
        ...(this.managementInfo || {}),
        investment: nextInvestments,
        moneyInHands: shouldDeduct
          ? (
              Number(this.managementInfo?.moneyInHands || 0) -
              Number(pending.amount)
            ).toString()
          : this.managementInfo?.moneyInHands,
      };
      this.getCurrentInvestment();
      this.showFeedback(
        shouldDeduct
          ? 'Investissement supprimé et montant déduit de moneyInHands.'
          : 'Investissement supprimé sans déduction de moneyInHands.',
        'success'
      );
    } catch (err: any) {
      this.showFeedback(
        `La suppression de l'investissement a échoué: ${err?.message || 'Erreur inconnue'}`,
        'error'
      );
    } finally {
      this.deletingInvestmentKey = null;
      this.closeDeleteInvestmentModal();
    }
  }
}
