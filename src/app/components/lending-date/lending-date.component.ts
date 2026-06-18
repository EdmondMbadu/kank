import { Component, OnInit } from '@angular/core';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

type PeriodMode = 'month' | 'year';

interface LendingEntry {
  firstName: string;
  lastName: string;
  middleName: string;
  loanAmount: number;
  date: string;
  dateLabel: string;
  month: number;
  year: number;
  timestamp: number;
  trackingId: string;
  amountToPay: string;
  amountPaid: string;
  paymentPeriodRange: string;
}

interface LendingMonthGroup {
  id: string;
  title: string;
  total: number;
  entryCount: number;
  entries: LendingEntry[];
}

@Component({
  selector: 'app-lending-date',
  templateUrl: './lending-date.component.html',
  styleUrls: ['./lending-date.component.css'],
})
export class LendingDateComponent implements OnInit {
  clients: Client[] = [];
  allLendingEntries: LendingEntry[] = [];
  filteredLendingEntries: LendingEntry[] = [];
  lendingGroups: LendingMonthGroup[] = [];

  periodMode: PeriodMode = 'month';
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  availableYears: number[] = [new Date().getFullYear()];
  searchQuery = '';

  totalGivenDate = 0;
  numberOfPeople = 0;

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

  constructor(public auth: AuthService, private time: TimeService) {}

  ngOnInit(): void {
    this.retrieveClients();
  }

  get currentUserEmail(): string {
    return this.auth.currentUser?.email || '';
  }

  get currentUserFirstName(): string {
    return this.auth.currentUser?.firstName || '';
  }

  get periodLabel(): string {
    if (this.periodMode === 'year') {
      return `${this.selectedYear}`;
    }
    return `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data || [];
      this.addClientIds();
      this.syncLendingEntries();
    });
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

  trackLendingGroup(_: number, group: LendingMonthGroup): string {
    return group.id;
  }

  trackLendingEntry(_: number, entry: LendingEntry): string {
    return `${entry.trackingId}-${entry.date}`;
  }

  private addClientIds(): void {
    this.clients.forEach((client, index) => {
      client.trackingId = `${index}`;
    });
  }

  private syncLendingEntries(): void {
    this.allLendingEntries = this.clients
      .filter((client) => !!client.debtCycleStartDate)
      .map((client) => {
        const date = client.debtCycleStartDate || '';
        const dateParts = this.parseDateKey(date);

        return {
          firstName: client.firstName || '',
          lastName: client.lastName || '',
          middleName: client.middleName || '',
          loanAmount: Number(client.loanAmount) || 0,
          date,
          dateLabel: this.formatDateLabel(date, dateParts),
          month: dateParts.month,
          year: dateParts.year,
          timestamp: dateParts.timestamp,
          trackingId: client.trackingId || '',
          amountToPay: client.amountToPay || '',
          amountPaid: client.amountPaid || '',
          paymentPeriodRange: client.paymentPeriodRange || '',
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    this.buildAvailableYears();
    this.applyFilters();
  }

  private buildAvailableYears(): void {
    const years = new Set<number>([new Date().getFullYear(), this.selectedYear]);
    this.allLendingEntries.forEach((entry) => years.add(entry.year));
    this.availableYears = Array.from(years).sort((a, b) => b - a);

    if (!years.has(this.selectedYear) && this.availableYears.length) {
      this.selectedYear = this.availableYears[0];
    }
  }

  private applyFilters(): void {
    const query = this.searchQuery.trim().toLowerCase();

    this.filteredLendingEntries = this.allLendingEntries
      .filter((entry) => {
        if (entry.year !== this.selectedYear) return false;
        if (this.periodMode === 'month' && entry.month !== this.selectedMonth) {
          return false;
        }
        if (!query) return true;

        const haystack = [
          entry.firstName,
          entry.lastName,
          entry.middleName,
          entry.date,
          entry.dateLabel,
          entry.loanAmount.toString(),
          entry.amountToPay,
          entry.amountPaid,
          entry.paymentPeriodRange,
          this.monthNames[entry.month - 1] || '',
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    this.totalGivenDate = this.filteredLendingEntries.reduce(
      (sum, entry) => sum + entry.loanAmount,
      0
    );
    this.numberOfPeople = this.filteredLendingEntries.length;
    this.lendingGroups = this.groupEntries(this.filteredLendingEntries);
  }

  private groupEntries(entries: LendingEntry[]): LendingMonthGroup[] {
    const groups = new Map<string, LendingMonthGroup>();

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
      group.total += entry.loanAmount;
      group.entryCount += 1;
    });

    return Array.from(groups.values());
  }

  private parseDateKey(key: string): {
    month: number;
    year: number;
    day: number;
    timestamp: number;
  } {
    const parsed = this.time.parseFlexibleDateTime(key);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        month: parsed.getMonth() + 1,
        year: parsed.getFullYear(),
        day: parsed.getDate(),
        timestamp: parsed.getTime(),
      };
    }

    const fallback = new Date();
    return {
      month: fallback.getMonth() + 1,
      year: fallback.getFullYear(),
      day: fallback.getDate(),
      timestamp: 0,
    };
  }

  private formatDateLabel(
    rawDate: string,
    dateParts: { month: number; year: number; day: number }
  ): string {
    if (!rawDate) {
      return '';
    }

    const monthName = this.monthNames[dateParts.month - 1] || '';
    return `${dateParts.day} ${monthName} ${dateParts.year}`;
  }
}
