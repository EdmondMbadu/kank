import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

type PeriodMode = 'month' | 'year';

interface ReserveRecord {
  dateKey: string;
  dateLabel: string;
  amount: number;
  month: number;
  year: number;
  timestamp: number;
}

@Component({
  selector: 'app-gestion-reserve',
  templateUrl: './gestion-reserve.component.html',
  styleUrls: ['./gestion-reserve.component.css'],
})
export class GestionReserveComponent {
  reserveAmount: string = '';
  reserve: Record<string, string> = {};
  currentUser: any = {};
  managementInfo?: Management = {};
  isLoading = false;
  records: ReserveRecord[] = [];
  filteredRecords: ReserveRecord[] = [];
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
      this.managementInfo = data?.[0] || {};
      this.getCurrentReserve();
    });
  }

  get periodLabel(): string {
    if (this.periodMode === 'year') return `${this.selectedYear}`;
    return `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  get visibleRecords(): ReserveRecord[] {
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
    if (this.isLoading) {
      return;
    }

    if (this.reserveAmount === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.reserveAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      let conf = confirm(
        ` Vous ajouter dans la reserve ${this.reserveAmount} FC. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }

      this.isLoading = true;

      try {
        await this.data.updateManagementInfoForAddToReserve(this.reserveAmount);
        this.router.navigate(['/gestion-today']);
      } catch (err: any) {
        alert("Une erreur s'est produite lors de l'initialization, Réessayez");
        console.log('error ocorred while entering reserve amount', err);
        this.isLoading = false; // Reset loading state on error
        return;
      }
    }
  }

  getCurrentReserve() {
    if (!this.managementInfo?.reserve) {
      this.reserve = {};
      this.records = [];
      this.filteredRecords = [];
      this.periodTotal = 0;
      return;
    }

    this.reserve = this.managementInfo.reserve as Record<string, string>;
    const entries = Object.entries(this.reserve) as Array<[string, string]>;

    this.records = entries.map(([dateKey, amountStr]) => {
      const dateParts = this.parseDateKey(dateKey);
      return {
        dateKey,
        dateLabel: this.time.convertTimeFormat(dateKey),
        amount: Number(amountStr) || 0,
        month: dateParts.month,
        year: dateParts.year,
        timestamp: dateParts.timestamp,
      };
    });

    this.records.sort((a, b) => b.timestamp - a.timestamp);
    this.buildAvailableYears();
    this.applyPeriodFilter();
  }

  trackByDateKey(index: number, record: { dateKey: string }) {
    return record?.dateKey ?? index;
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

  canSubmit(): boolean {
    const amount = Number(this.reserveAmount);
    return !!this.reserveAmount && !isNaN(amount) && amount > 0;
  }

  hasMoreRecords(): boolean {
    return this.filteredRecords.length > 3;
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
}
