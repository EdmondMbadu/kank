import { Component } from '@angular/core';
import { Management, MoneyInHandsActivity } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

type PeriodMode = 'month' | 'year';

interface MoneyInHandsActivityRow {
  key: string;
  dateLabel: string;
  month: number;
  year: number;
  monthLabel: string;
  timestamp: number;
  previousAmount: number | null;
  changeAmount: number | null;
  newAmount: number;
  source: string;
  action: string;
  note: string;
  relatedEntryKey?: string;
  createdBy?: string;
  isLegacy: boolean;
}

interface MoneyInHandsActivityGroup {
  monthLabel: string;
  totalChange: number;
  records: MoneyInHandsActivityRow[];
}

@Component({
  selector: 'app-gestion-money-in-hands-activity',
  templateUrl: './gestion-money-in-hands-activity.component.html',
  styleUrls: ['./gestion-money-in-hands-activity.component.css'],
})
export class GestionMoneyInHandsActivityComponent {
  managementInfo?: Management = {};
  allRows: MoneyInHandsActivityRow[] = [];
  filteredRows: MoneyInHandsActivityRow[] = [];

  periodMode: PeriodMode = 'month';
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  availableYears: number[] = [];
  periodNetChange = 0;
  currentMoneyInHands = 0;

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
    private time: TimeService,
    private compute: ComputationService
  ) {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data?.[0] || {};
      this.currentMoneyInHands = Number(this.managementInfo?.moneyInHands || 0);
      this.buildRows();
    });
  }

  get periodLabel(): string {
    if (this.periodMode === 'year') {
      return `${this.selectedYear}`;
    }
    return `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  get activityGroups(): MoneyInHandsActivityGroup[] {
    const groups = new Map<string, MoneyInHandsActivityGroup>();

    this.filteredRows.forEach((row) => {
      const existing = groups.get(row.monthLabel);
      if (existing) {
        existing.records.push(row);
        existing.totalChange += row.changeAmount || 0;
        return;
      }

      groups.set(row.monthLabel, {
        monthLabel: row.monthLabel,
        totalChange: row.changeAmount || 0,
        records: [row],
      });
    });

    return Array.from(groups.values());
  }

  toUsd(amountFC: number | string): number {
    const fc = Number(amountFC) || 0;
    const converted = this.compute.convertCongoleseFrancToUsDollars(
      fc.toString()
    );
    return Number(converted) || 0;
  }

  setPeriodMode(mode: PeriodMode): void {
    if (this.periodMode === mode) return;
    this.periodMode = mode;
    this.applyPeriodFilter();
  }

  onMonthChange(month: string): void {
    this.selectedMonth = Number(month);
    this.applyPeriodFilter();
  }

  onYearChange(year: string): void {
    this.selectedYear = Number(year);
    this.applyPeriodFilter();
  }

  private buildRows(): void {
    const activities = this.managementInfo?.moneyInHandsActivities || {};
    const rows = Object.entries(activities).map(([key, entry]) =>
      this.toActivityRow(key, entry)
    );

    const relatedEntryKeys = new Set(
      rows.map((row) => row.relatedEntryKey).filter(Boolean)
    );

    const legacyTracking = this.managementInfo?.moneyInHandsTracking || {};
    Object.entries(legacyTracking).forEach(([key, value]) => {
      if (relatedEntryKeys.has(key)) return;
      rows.push(this.toLegacyRow(key, value));
    });

    this.allRows = rows.sort((a, b) => b.timestamp - a.timestamp);
    this.buildAvailableYears();
    this.applyPeriodFilter();
  }

  private toActivityRow(
    key: string,
    entry: MoneyInHandsActivity
  ): MoneyInHandsActivityRow {
    const dateParts = this.parseDateKey(key);
    return {
      key,
      dateLabel: this.time.convertTimeFormat(key),
      month: dateParts.month,
      year: dateParts.year,
      monthLabel: this.monthLabel(dateParts.month, dateParts.year),
      timestamp: dateParts.timestamp,
      previousAmount: Number(entry.previousAmount || 0),
      changeAmount: Number(entry.changeAmount || 0),
      newAmount: Number(entry.newAmount || 0),
      source: entry.source || 'Argent en main',
      action: entry.action || 'Changement',
      note: entry.note || '',
      relatedEntryKey: entry.relatedEntryKey,
      createdBy: entry.createdBy,
      isLegacy: false,
    };
  }

  private toLegacyRow(key: string, value: string): MoneyInHandsActivityRow {
    const dateParts = this.parseDateKey(key);
    return {
      key,
      dateLabel: this.time.convertTimeFormat(key),
      month: dateParts.month,
      year: dateParts.year,
      monthLabel: this.monthLabel(dateParts.month, dateParts.year),
      timestamp: dateParts.timestamp,
      previousAmount: null,
      changeAmount: null,
      newAmount: Number(value || 0),
      source: 'Argent servi',
      action: 'Ancien suivi argent en main',
      note:
        "Ancien enregistrement: seul le solde après l'opération était sauvegardé.",
      relatedEntryKey: key,
      isLegacy: true,
    };
  }

  private applyPeriodFilter(): void {
    this.filteredRows = this.allRows.filter((row) => {
      if (row.year !== this.selectedYear) return false;
      if (this.periodMode === 'month' && row.month !== this.selectedMonth) {
        return false;
      }
      return true;
    });

    this.periodNetChange = this.filteredRows.reduce(
      (sum, row) => sum + (row.changeAmount || 0),
      0
    );
  }

  private buildAvailableYears(): void {
    const years = new Set<number>([new Date().getFullYear(), this.selectedYear]);
    this.allRows.forEach((row) => years.add(row.year));
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

  private monthLabel(month: number, year: number): string {
    return `${this.monthNames[month - 1] || month} ${year}`;
  }
}
