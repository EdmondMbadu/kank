import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-not-paid',
  templateUrl: './not-paid.component.html',
  styleUrls: ['./not-paid.component.css'],
})
export class NotPaidComponent implements OnInit {
  employees: Employee[] = [];
  clients?: Client[];
  searchControl = new FormControl();
  totalGivenDate: number = 0;
  numberofPeopleWhodidNotPay: number = 0;
  haveNotPaid?: Client[] = [];
  haveNotPaidCopy?: Client[] = [];
  validStartDate: boolean = true;
  validEndDate: boolean = true;
  datesRange: string[] = [];
  startDate: string = '';
  endDate: string = '';
  showWarning: boolean = false;

  /* NEW – clients 5 + months into a debt cycle that is not finished */
  cycleNotFinished?: Client[] = [];
  cycleNotFinishedCopy: Client[] = []; // for search
  cycleClientCount = 0;
  totalCycleDebt = 0;

  /* simple toggle */
  activeList: 'cycle' | 'noPay' = 'cycle';
  /* threshold in months – default 5 */
  monthsThreshold = 5;

  /* --- threshold for the no-payment list (in months) --- */
  noPayMonthsThreshold = 5; // default 5 mois

  /** called whenever the input changes */
  onThresholdChange(val: string | number): void {
    const n = Number(val);
    if (!n || n < 1) return; // ignore bad input
    this.monthsThreshold = n;
    this.computeCycleNotFinished(); // recompute list live
  }

  constructor(
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {
    this.retrieveClients();
  }
  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => this.search(value))
      )
      .subscribe((results) => {
        if (this.activeList === 'cycle') {
          this.cycleNotFinished = results; // ⇦ update cycle tab
        } else {
          this.haveNotPaid = results; // ⇦ update no-pay tab
        }
      });
  }

  find5WeeksOrMoreNotPaid() {
    // The user typed something (e.g. "3" or "5") into the search bar.
    // Convert that to a number of weeks:
    this.haveNotPaid = this.clients;
    this.haveNotPaid = this.haveNotPaid?.filter((client) => {
      const weeks = parseInt('20', 10);
      if (isNaN(weeks) || weeks <= 0) {
        // If they typed something not a valid number, skip or return false
        return false;
      }
      if (Number(client.debtLeft) <= 0) {
        return false;
      }
      // filter out clients who died.
      if (client.vitalStatus === 'Mort') {
        return false;
      }
      const WEEKS_IN_MS = weeks * 7 * 24 * 60 * 60 * 1000;
      const now = new Date();
      // We only filter if the client has a debtCycleStartDate AND payments
      if (client.debtCycleStartDate && client.payments) {
        const [startMonth, startDay, startYear] = client.debtCycleStartDate
          .split('-')
          .map(Number);
        const debtCycleStartDate = new Date(
          startYear,
          startMonth - 1,
          startDay
        );
        // If the total time since the debt cycle started is < X weeks, exclude
        if (now.getTime() - debtCycleStartDate.getTime() < WEEKS_IN_MS) {
          return false;
        }
        // Check if the client made any payment within the last X weeks
        const recentPaymentExists = Object.keys(client.payments).some(
          (paymentDate) => {
            const [payMonth, payDay, payYear] = paymentDate
              .split('-')
              .map(Number);
            const paymentDateObj = new Date(payYear, payMonth - 1, payDay);
            return now.getTime() - paymentDateObj.getTime() < WEEKS_IN_MS;
          }
        );
        // We only want those who do NOT have a recent payment
        // (meaning no payment within the last X weeks)
        return !recentPaymentExists;
      }
      return false;
    }); // No start date or no payments
    this.haveNotPaidCopy = structuredClone(this.haveNotPaid);
    this.numberofPeopleWhodidNotPay = this.haveNotPaid!.length;
    this.totalGivenDate = this.haveNotPaid!.reduce(
      (sum, { debtLeft }) => sum + Number(debtLeft),
      0
    );
    this.showWarning = true;
  }

  onNoPayMonthsChange(val: string | number): void {
    const n = Number(val);
    if (!n || n < 1) return; // ignore invalid
    this.noPayMonthsThreshold = n;
    this.computeNoPayList(); // recompute instantly
  }

  private computeNoPayList(): void {
    if (!this.clients) return;

    const MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30-day month
    const thresholdMs = this.noPayMonthsThreshold * MONTH_MS;
    const now = Date.now();

    this.haveNotPaid = this.clients.filter((client) => {
      if (!client.debtCycleStartDate || !client.payments) return false;
      if (+client.debtLeft! <= 0) return false;
      if (client.vitalStatus === 'Mort') return false;

      /* debt cycle must be older than threshold */
      const [m, d, y] = client.debtCycleStartDate.split('-').map(Number);
      const cycleStart = new Date(y, m - 1, d).getTime();
      if (now - cycleStart < thresholdMs) return false;

      /* no payment within the same threshold */
      const recentPayment = Object.keys(client.payments).some((dateStr) => {
        const [pm, pd, py] = dateStr.split('-').map(Number);
        const payDate = new Date(py, pm - 1, pd).getTime();
        return now - payDate < thresholdMs;
      });

      return !recentPayment;
    });

    /* duplicates of your old stats logic */
    this.haveNotPaidCopy = structuredClone(this.haveNotPaid);
    this.numberofPeopleWhodidNotPay = this.haveNotPaid.length;
    this.totalGivenDate = this.haveNotPaid.reduce(
      (s, c) => s + +c.debtLeft!,
      0
    );
  }

  searchThoseWhoDidNotPayPerInterval() {
    this.showWarning = false;
    this.validStartDate = this.time.isDateInRange(this.startDate);
    this.validEndDate = this.time.isDateInRange(this.endDate);

    if (
      this.validStartDate &&
      this.validEndDate &&
      this.time.isEndDateGreater(this.startDate, this.endDate)
    ) {
      this.datesRange = this.time.getDatesInRange(this.startDate, this.endDate);
      this.haveNotPaid = this.time.filterClientsByPaymentDates(
        this.clients!,
        this.datesRange
      );
      this.haveNotPaidCopy = structuredClone(this.haveNotPaid);
      this.totalGivenDate = this.compute.computeExpectedPerDate(
        this.haveNotPaid
      );

      this.numberofPeopleWhodidNotPay = this.haveNotPaid.length;
    } else {
      alert('Les dates ne sont pas valides. Entrez des date valides.');
    }
  }
  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      // filter out clients that have not debt( registered) or have finished their debts.

      this.retrieveEmployees();
      this.computeCycleNotFinished(); // ← NEW
      this.find5WeeksOrMoreNotPaid();
    });
  }

  addId() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
      let emp = this.employees.find(
        (element) => element.uid === this.clients![i].agent
      );
      this.clients![i].employee = emp;
    }
    this.clients = this.clients!.filter(
      (client: Client) => Number(client.debtLeft) > 0
    );
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.addId();
    });
  }

  search(value: string) {
    const base =
      this.activeList === 'cycle'
        ? this.cycleNotFinishedCopy
        : this.haveNotPaidCopy;

    if (!value) return of(base);

    const v = value.toLowerCase();
    return of(
      base!.filter(
        (c) =>
          c.firstName?.toLowerCase().includes(v) ||
          c.lastName?.toLowerCase().includes(v) ||
          c.middleName?.toLowerCase().includes(v) ||
          c.amountPaid?.includes(v)
      )
    );
  }

  /* update the helper that builds the cycle list */
  private computeCycleNotFinished(): void {
    const today = new Date();
    this.cycleNotFinished = (this.clients ?? []).filter((c) => {
      if (!c.debtCycleStartDate) return false;
      if (+c.debtLeft! <= 0) return false;

      const [mm, dd, yyyy] = c.debtCycleStartDate.split('-').map(Number);
      const start = new Date(yyyy, mm - 1, dd);
      const diffMonths =
        (today.getFullYear() - start.getFullYear()) * 12 +
        (today.getMonth() - start.getMonth());

      return diffMonths >= this.monthsThreshold;
    });

    /* NEW – counters for the template */
    this.cycleClientCount = this.cycleNotFinished.length;
    this.totalCycleDebt = this.cycleNotFinished.reduce(
      (sum, c) => sum + +c.debtLeft!,
      0
    );

    this.cycleNotFinishedCopy = structuredClone(this.cycleNotFinished);
  }
}
