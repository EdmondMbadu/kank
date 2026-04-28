import { Component, OnDestroy } from '@angular/core';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

type PeriodMode = 'month' | 'year';
type LossSource = 'exchange' | 'transfer';

interface LossEntry {
  key: string;
  amount: number;
  dateLabel: string;
  month: number;
  year: number;
  timestamp: number;
  source: LossSource;
  currency: 'FC' | 'USD';
}

interface LossMonthGroup {
  id: string;
  title: string;
  total: number;
  entryCount: number;
  entries: LossEntry[];
}

interface PendingLossAction {
  key: string;
  amount: number;
  dateLabel: string;
  source: LossSource;
  currency: 'FC' | 'USD';
}

@Component({
  selector: 'app-gestion-loss',
  templateUrl: './gestion-loss.component.html',
  styleUrls: ['./gestion-loss.component.css'],
})
export class GestionLossComponent implements OnDestroy {
  lossAmount = '';
  currentUser: any = {};
  managementInfo?: Management = {};

  periodMode: PeriodMode = 'month';
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  availableYears: number[] = [];
  searchQuery = '';

  allExchangeLossEntries: LossEntry[] = [];
  filteredExchangeLossEntries: LossEntry[] = [];
  exchangeLossGroups: LossMonthGroup[] = [];
  exchangePeriodTotal = 0;
  showExchangeSection = false;

  allTransferLossEntries: LossEntry[] = [];
  filteredTransferLossEntries: LossEntry[] = [];
  transferLossGroups: LossMonthGroup[] = [];
  transferPeriodTotal = 0;
  showTransferSection = false;

  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';
  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  showDeleteLossModal = false;
  deletingLossKey: string | null = null;
  pendingDeleteLoss: PendingLossAction | null = null;

  showEditLossModal = false;
  savingLossKey: string | null = null;
  pendingEditLoss: PendingLossAction | null = null;
  editLossAmount = '';

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

  constructor(
    public auth: AuthService,
    private data: DataService,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.currentUser = this.auth.currentUser;
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.syncLossEntries();
    });
  }

  ngOnDestroy(): void {
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
      this.feedbackTimeout = null;
    }
  }

  get periodLabel(): string {
    if (this.periodMode === 'year') {
      return `${this.selectedYear}`;
    }
    return `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  get totalVisibleLossEntries(): number {
    return (
      this.filteredExchangeLossEntries.length + this.filteredTransferLossEntries.length
    );
  }

  get combinedPeriodTotalFc(): number {
    return this.exchangePeriodTotal + this.toFc(this.transferPeriodTotal);
  }

  get combinedPeriodTotalUsd(): number {
    return this.toUsd(this.exchangePeriodTotal) + this.transferPeriodTotal;
  }

  get userInitials(): string {
    const source = this.currentUser?.firstName || this.auth.currentUser?.firstName || 'KA';
    return source.substring(0, 2).toUpperCase();
  }

  toUsd(amountFC: number | string): number {
    const fc = Number(amountFC) || 0;
    const converted = this.compute.convertCongoleseFrancToUsDollars(
      fc.toString()
    );
    return Number(converted) || 0;
  }

  toFc(amountUsd: number | string): number {
    const usd = Number(amountUsd) || 0;
    const converted = this.compute.convertUsDollarsToCongoleseFranc(
      usd.toString()
    );
    return Number(converted) || 0;
  }

  async addLoss(): Promise<void> {
    if (this.lossAmount.trim() === '') {
      this.showFeedback('Entrez un montant avant d’ajouter une perte.', 'error');
      return;
    }

    if (isNaN(Number(this.lossAmount))) {
      this.showFeedback('Entrez un montant valide.', 'error');
      return;
    }

    const confirmed = confirm(
      `Vous allez ajouter ${this.lossAmount} FC dans la perte d'échange d'aujourd'hui. Voulez-vous continuer ?`
    );
    if (!confirmed) {
      return;
    }

    try {
      await this.data.updateManagementInfoForMoneyLoss(this.lossAmount);
      this.lossAmount = '';
      this.showFeedback('Perte d’échange ajoutée avec succès.', 'success');
    } catch (err: any) {
      this.showFeedback(
        `L’ajout de la perte a échoué: ${err?.message || 'Erreur inconnue'}`,
        'error'
      );
    }
  }

  setPeriodMode(mode: PeriodMode): void {
    if (this.periodMode === mode) return;
    this.periodMode = mode;
    this.applyFilters();
  }

  onMonthChange(month: string): void {
    this.selectedMonth = Number(month);
    this.applyFilters();
  }

  onYearChange(year: string): void {
    this.selectedYear = Number(year);
    this.applyFilters();
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.applyFilters();
  }

  openDeleteLossModal(entry: LossEntry, event: Event): void {
    event.stopPropagation();
    if (!this.auth.isAdmin) return;
    if (this.deletingLossKey) return;

    this.pendingDeleteLoss = {
      key: entry.key,
      amount: entry.amount,
      dateLabel: entry.dateLabel,
      source: entry.source,
      currency: entry.currency,
    };
    this.showDeleteLossModal = true;
  }

  closeDeleteLossModal(): void {
    if (this.deletingLossKey) return;
    this.showDeleteLossModal = false;
    this.pendingDeleteLoss = null;
  }

  async confirmDeleteLoss(
    choice: 'deleteOnly' | 'deleteAndRestore' = 'deleteOnly'
  ): Promise<void> {
    const pending = this.pendingDeleteLoss;
    if (!pending) return;

    try {
      this.deletingLossKey = pending.key;

      if (pending.source === 'exchange') {
        const shouldRestore = choice === 'deleteAndRestore';
        await this.data.deleteManagementExchangeLossEntry(
          pending.key,
          shouldRestore
        );

        const nextExchangeLoss = { ...(this.managementInfo?.exchangeLoss || {}) };
        delete nextExchangeLoss[pending.key];
        this.managementInfo = {
          ...(this.managementInfo || {}),
          exchangeLoss: nextExchangeLoss,
          moneyInHands: shouldRestore
            ? (
                Number(this.managementInfo?.moneyInHands || 0) +
                Number(pending.amount)
              ).toString()
            : this.managementInfo?.moneyInHands,
        };

        this.showFeedback(
          shouldRestore
            ? 'Perte supprimée et moneyInHands restauré.'
            : 'Perte supprimée sans modifier moneyInHands.',
          'success'
        );
      } else {
        await this.data.deleteManagementDollarTransferLossEntry(pending.key);

        const nextDollarTransferLoss = {
          ...(this.managementInfo?.dollarTransferLoss || {}),
        };
        delete nextDollarTransferLoss[pending.key];
        this.managementInfo = {
          ...(this.managementInfo || {}),
          dollarTransferLoss: nextDollarTransferLoss,
        };

        this.showFeedback('Perte de transfert supprimée.', 'success');
      }

      this.syncLossEntries();
    } catch (err: any) {
      this.showFeedback(
        `La suppression de la perte a échoué: ${err?.message || 'Erreur inconnue'}`,
        'error'
      );
    } finally {
      this.deletingLossKey = null;
      this.closeDeleteLossModal();
    }
  }

  openEditLossModal(entry: LossEntry, event: Event): void {
    event.stopPropagation();
    if (!this.auth.isAdmin) return;
    if (this.savingLossKey) return;

    this.pendingEditLoss = {
      key: entry.key,
      amount: entry.amount,
      dateLabel: entry.dateLabel,
      source: entry.source,
      currency: entry.currency,
    };
    this.editLossAmount = entry.amount.toString();
    this.showEditLossModal = true;
  }

  closeEditLossModal(): void {
    if (this.savingLossKey) return;
    this.showEditLossModal = false;
    this.pendingEditLoss = null;
    this.editLossAmount = '';
  }

  async confirmEditLoss(
    choice: 'updateOnly' | 'updateAndAdjust' = 'updateOnly'
  ): Promise<void> {
    const pending = this.pendingEditLoss;
    if (!pending) return;

    if (this.editLossAmount.trim() === '') {
      this.showFeedback('Entrez un montant avant d’enregistrer.', 'error');
      return;
    }

    if (isNaN(Number(this.editLossAmount))) {
      this.showFeedback('Entrez un montant valide.', 'error');
      return;
    }

    const nextAmount = Number(this.editLossAmount) || 0;

    try {
      this.savingLossKey = pending.key;

      if (pending.source === 'exchange') {
        const shouldAdjust = choice === 'updateAndAdjust';
        await this.data.updateManagementExchangeLossEntry(
          pending.key,
          this.editLossAmount,
          shouldAdjust
        );

        const nextExchangeLoss = {
          ...(this.managementInfo?.exchangeLoss || {}),
          [pending.key]: this.editLossAmount,
        };
        const delta = nextAmount - Number(pending.amount || 0);
        this.managementInfo = {
          ...(this.managementInfo || {}),
          exchangeLoss: nextExchangeLoss,
          moneyInHands: shouldAdjust
            ? (
                Number(this.managementInfo?.moneyInHands || 0) - delta
              ).toString()
            : this.managementInfo?.moneyInHands,
        };

        this.showFeedback(
          shouldAdjust
            ? 'Perte mise à jour et moneyInHands ajusté.'
            : 'Perte mise à jour sans modifier moneyInHands.',
          'success'
        );
      } else {
        await this.data.updateManagementDollarTransferLossEntry(
          pending.key,
          this.editLossAmount
        );

        this.managementInfo = {
          ...(this.managementInfo || {}),
          dollarTransferLoss: {
            ...(this.managementInfo?.dollarTransferLoss || {}),
            [pending.key]: this.editLossAmount,
          },
        };

        this.showFeedback('Perte de transfert mise à jour.', 'success');
      }

      this.syncLossEntries();
    } catch (err: any) {
      this.showFeedback(
        `La mise à jour de la perte a échoué: ${err?.message || 'Erreur inconnue'}`,
        'error'
      );
    } finally {
      this.savingLossKey = null;
      this.closeEditLossModal();
    }
  }

  trackLossGroup(_: number, group: LossMonthGroup): string {
    return group.id;
  }

  trackLossEntry(_: number, entry: LossEntry): string {
    return `${entry.source}-${entry.key}`;
  }

  private syncLossEntries(): void {
    this.allExchangeLossEntries = this.buildLossEntries(
      this.managementInfo?.exchangeLoss || {},
      'exchange',
      'FC'
    );
    this.allTransferLossEntries = this.buildLossEntries(
      this.managementInfo?.dollarTransferLoss || {},
      'transfer',
      'USD'
    );
    this.buildAvailableYears();
    this.applyFilters();
  }

  private buildLossEntries(
    sourceMap: { [key: string]: string },
    source: LossSource,
    currency: 'FC' | 'USD'
  ): LossEntry[] {
    const sortedEntries = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(sourceMap || {})
    );

    return sortedEntries.map(([key, rawValue]) => {
      const dateParts = this.parseDateKey(key);
      return {
        key,
        amount: Number(rawValue) || 0,
        dateLabel: this.time.convertTimeFormat(key),
        month: dateParts.month,
        year: dateParts.year,
        timestamp: dateParts.timestamp,
        source,
        currency,
      };
    });
  }

  private buildAvailableYears(): void {
    const years = new Set<number>([new Date().getFullYear(), this.selectedYear]);
    this.allExchangeLossEntries.forEach((entry) => years.add(entry.year));
    this.allTransferLossEntries.forEach((entry) => years.add(entry.year));
    this.availableYears = Array.from(years).sort((a, b) => b - a);

    if (!years.has(this.selectedYear) && this.availableYears.length) {
      this.selectedYear = this.availableYears[0];
    }
  }

  private applyFilters(): void {
    this.filteredExchangeLossEntries = this.filterEntries(
      this.allExchangeLossEntries
    );
    this.filteredTransferLossEntries = this.filterEntries(
      this.allTransferLossEntries
    );

    this.exchangePeriodTotal = this.filteredExchangeLossEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
    this.transferPeriodTotal = this.filteredTransferLossEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );

    this.exchangeLossGroups = this.groupEntries(this.filteredExchangeLossEntries);
    this.transferLossGroups = this.groupEntries(this.filteredTransferLossEntries);
  }

  private filterEntries(entries: LossEntry[]): LossEntry[] {
    const query = this.searchQuery.trim().toLowerCase();

    return entries
      .filter((entry) => {
        if (entry.year !== this.selectedYear) return false;
        if (this.periodMode === 'month' && entry.month !== this.selectedMonth) {
          return false;
        }
        if (!query) return true;

        const haystack = [
          entry.dateLabel.toLowerCase(),
          entry.amount.toString(),
          this.monthNames[entry.month - 1]?.toLowerCase() || '',
          entry.currency.toLowerCase(),
          entry.source === 'exchange'
            ? 'perte echange perte échange'
            : 'perte transfert dollar banque',
        ].join(' ');

        return haystack.includes(query);
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private groupEntries(entries: LossEntry[]): LossMonthGroup[] {
    const groups = new Map<string, LossMonthGroup>();

    entries.forEach((entry) => {
      const id = `${entry.year}-${entry.month}`;
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          title: `${this.monthNames[entry.month - 1]} ${entry.year}`,
          total: 0,
          entryCount: 0,
          entries: [],
        });
      }

      const group = groups.get(id)!;
      group.entries.push(entry);
      group.total += entry.amount;
      group.entryCount += 1;
    });

    return Array.from(groups.values());
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
