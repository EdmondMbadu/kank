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

    this.allRows = this.sortRowsByTimestampWithLocalBalanceRepair(rows);
    this.buildAvailableYears();
    this.applyPeriodFilter();
  }

  private sortRowsByTimestampWithLocalBalanceRepair(
    rows: MoneyInHandsActivityRow[]
  ): MoneyInHandsActivityRow[] {
    const sorted = [...rows].sort((a, b) => this.compareByTimestampDesc(a, b));
    const ordered: MoneyInHandsActivityRow[] = [];
    let cluster: MoneyInHandsActivityRow[] = [];

    sorted.forEach((row) => {
      if (!this.canBalanceRepair(row)) {
        ordered.push(...this.sortLocalClusterByBalanceSequence(cluster));
        cluster = [];
        ordered.push(row);
        return;
      }

      const previous = cluster[cluster.length - 1];
      if (!previous || this.isSameLocalCluster(previous, row)) {
        cluster.push(row);
        return;
      }

      ordered.push(...this.sortLocalClusterByBalanceSequence(cluster));
      cluster = [row];
    });

    ordered.push(...this.sortLocalClusterByBalanceSequence(cluster));
    return ordered;
  }

  private sortLocalClusterByBalanceSequence(
    rows: MoneyInHandsActivityRow[]
  ): MoneyInHandsActivityRow[] {
    if (rows.length <= 1) {
      return rows;
    }

    const remaining = [...rows];
    const ordered: MoneyInHandsActivityRow[] = [];

    while (remaining.length > 0) {
      let nextIndex = this.findLocalChainEndIndex(remaining);
      let [nextRow] = remaining.splice(nextIndex, 1);
      ordered.push(nextRow);

      while (nextRow.previousAmount !== null) {
        const linkedIndex = this.findUniqueNewAmountIndex(
          remaining,
          nextRow.previousAmount
        );
        if (linkedIndex === -1) {
          break;
        }

        [nextRow] = remaining.splice(linkedIndex, 1);
        ordered.push(nextRow);
      }
    }

    return ordered;
  }

  private findLocalChainEndIndex(rows: MoneyInHandsActivityRow[]): number {
    const chainEndIndexes = rows
      .map((row, index) => ({ row, index }))
      .filter(
        ({ row }) =>
          !rows.some((candidate) =>
            this.sameAmount(candidate.previousAmount, row.newAmount)
          )
      )
      .map(({ index }) => index);

    return chainEndIndexes.length > 0 ? chainEndIndexes[0] : 0;
  }

  private findUniqueNewAmountIndex(
    rows: MoneyInHandsActivityRow[],
    amount: number
  ): number {
    const matches = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => this.sameAmount(row.newAmount, amount));

    return matches.length === 1 ? matches[0].index : -1;
  }

  private compareByTimestampDesc(
    a: MoneyInHandsActivityRow,
    b: MoneyInHandsActivityRow
  ): number {
    if (b.timestamp !== a.timestamp) {
      return b.timestamp - a.timestamp;
    }

    return b.key.localeCompare(a.key);
  }

  private sameAmount(
    left: number | null | undefined,
    right: number | null | undefined
  ): boolean {
    return left != null && right != null && left === right;
  }

  private canBalanceRepair(row: MoneyInHandsActivityRow): boolean {
    return !row.isLegacy && row.previousAmount !== null && row.timestamp > 0;
  }

  private isSameLocalCluster(
    newer: MoneyInHandsActivityRow,
    older: MoneyInHandsActivityRow
  ): boolean {
    const maxGapMs = 10 * 60 * 1000;
    return (
      this.sameCalendarDay(newer.timestamp, older.timestamp) &&
      Math.abs(newer.timestamp - older.timestamp) <= maxGapMs
    );
  }

  private sameCalendarDay(leftTimestamp: number, rightTimestamp: number): boolean {
    const left = new Date(leftTimestamp);
    const right = new Date(rightTimestamp);
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  private toActivityRow(
    key: string,
    entry: MoneyInHandsActivity
  ): MoneyInHandsActivityRow {
    const activityDate = this.parseActivityDate(entry.createdAt, key);
    const dateParts = this.datePartsFromDate(activityDate);
    return {
      key,
      dateLabel: this.formatActivityDate(activityDate),
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
    return this.datePartsFromDate(this.time.parseFlexibleDateTime(key));
  }

  private parseActivityDate(createdAt: any, fallbackKey: string): Date {
    if (createdAt?.toDate) {
      const parsed = createdAt.toDate();
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (typeof createdAt?.seconds === 'number') {
      const milliseconds =
        createdAt.seconds * 1000 +
        Math.floor((createdAt.nanoseconds || 0) / 1000000);
      const parsed = new Date(milliseconds);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) {
      return createdAt;
    }

    if (typeof createdAt === 'string') {
      const parsed = this.time.parseFlexibleDateTime(createdAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return this.time.parseFlexibleDateTime(fallbackKey);
  }

  private datePartsFromDate(date: Date): {
    month: number;
    year: number;
    timestamp: number;
  } {
    const parsed = date;
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

  private formatActivityDate(date: Date): string {
    const monthNames = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    const day = date.getDate();
    const month = monthNames[date.getMonth()] || '';
    const year = date.getFullYear();
    const hour = (`0${date.getHours()}`).slice(-2);
    const minute = (`0${date.getMinutes()}`).slice(-2);

    return `${day} ${month} ${year} à ${hour}:${minute}`;
  }

  private monthLabel(month: number, year: number): string {
    return `${this.monthNames[month - 1] || month} ${year}`;
  }
}
