import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

type PeriodMode = 'month' | 'year';

interface ServedRecord {
  dateKey: string;
  dateLabel: string;
  amount: number;
  leftAfter: number | null;
  month: number;
  year: number;
  timestamp: number;
}

@Component({
  selector: 'app-gestion-served',
  templateUrl: './gestion-served.component.html',
  styleUrls: ['./gestion-served.component.css'],
})
export class GestionServedComponent {
  reserveAmount: string = '';
  moneyGiven: Record<string, string> = {};
  currentUser: any = {};
  managementInfo?: Management = {};
  records: ServedRecord[] = [];
  filteredRecords: ServedRecord[] = [];
  showAllRecords = false;
  showPeriodPanel = false;

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

  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.getCurrentServed();
    });
  }

  get periodLabel(): string {
    if (this.periodMode === 'year') return `${this.selectedYear}`;
    return `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  get visibleRecords(): ServedRecord[] {
    return this.showAllRecords
      ? this.filteredRecords
      : this.filteredRecords.slice(0, 3);
  }

  toUsd(amountFC: number | string): number {
    const fc = Number(amountFC) || 0;
    const converted = this.compute.convertCongoleseFrancToUsDollars(
      fc.toString()
    );
    return Number(converted) || 0;
  }

  async addToReserve() {
    if (this.reserveAmount === '') {
      alert('Fill all fields!');
      return;
    }
    if (isNaN(Number(this.reserveAmount))) {
      alert('Enter a valid number!');
      return;
    }

    const conf = confirm(
      `Vous allez marquer ${Number(
        this.reserveAmount
      ).toLocaleString()} FC comme "Argent à servir" (demain/aujourd'hui). Continuer ?`
    );
    if (!conf) return;

    try {
      await this.data.updateManagementInfoForMoneyGiven(this.reserveAmount);
      this.router.navigate(['/gestion-today']);
    } catch (err) {
      alert("Une erreur s'est produite. Réessayez.");
      console.error('reserve amount error', err);
    }
  }

  getCurrentServed() {
    if (!this.managementInfo?.moneyGiven) {
      this.moneyGiven = {};
      this.records = [];
      this.filteredRecords = [];
      this.periodTotal = 0;
      return;
    }

    this.moneyGiven = this.managementInfo.moneyGiven as Record<string, string>;
    const tracking =
      (this.managementInfo.moneyInHandsTracking as Record<string, string>) ||
      {};

    // Create records array from entries
    const entries = Object.entries(this.moneyGiven) as Array<[string, string]>; // [dateKey, amountStr]

    this.records = entries.map(([dateKey, amountStr]) => {
      const leftStr = tracking?.[dateKey];
      const dateParts = this.parseDateKey(dateKey);
      return {
        dateKey,
        dateLabel: this.time.convertTimeFormat(dateKey),
        amount: Number(amountStr),
        leftAfter: leftStr != null ? Number(leftStr) : null, // graceful if not present
        month: dateParts.month,
        year: dateParts.year,
        timestamp: dateParts.timestamp,
      };
    });

    this.records.sort((a, b) => b.timestamp - a.timestamp);
    this.buildAvailableYears();
    this.applyPeriodFilter();
  }
  trackByDateKey(index: number, r: { dateKey: string }) {
    return r?.dateKey ?? index;
  }

  setPeriodMode(mode: PeriodMode): void {
    if (this.periodMode === mode) return;
    this.periodMode = mode;
    this.showAllRecords = false;
    this.applyPeriodFilter();
  }

  onMonthChange(month: string): void {
    this.selectedMonth = Number(month);
    this.showAllRecords = false;
    this.applyPeriodFilter();
  }

  onYearChange(year: string): void {
    this.selectedYear = Number(year);
    this.showAllRecords = false;
    this.applyPeriodFilter();
  }

  private applyPeriodFilter(): void {
    const base = this.records.filter((record) => {
      if (record.year !== this.selectedYear) return false;
      if (this.periodMode === 'month' && record.month !== this.selectedMonth) {
        return false;
      }
      return true;
    });

    this.filteredRecords = [...base].sort((a, b) => b.timestamp - a.timestamp);
    this.periodTotal = this.filteredRecords.reduce(
      (sum, record) => sum + record.amount,
      0
    );
  }

  private buildAvailableYears(): void {
    const years = new Set<number>([new Date().getFullYear(), this.selectedYear]);
    this.records.forEach((record) => years.add(record.year));
    this.availableYears = Array.from(years).sort((a, b) => b - a);
    if (!years.has(this.selectedYear) && this.availableYears.length) {
      this.selectedYear = this.availableYears[0];
    }
  }

  private parseDateKey(dateKey: string): {
    month: number;
    year: number;
    timestamp: number;
  } {
    const parsed = this.time.parseFlexibleDateTime(dateKey);
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

  // helper: enable/disable "Ajouter"
  canSubmit(): boolean {
    const n = Number(this.reserveAmount);
    return !!this.reserveAmount && !isNaN(n) && n > 0;
  }

  hasMoreRecords(): boolean {
    return this.filteredRecords.length > 3;
  }
}
