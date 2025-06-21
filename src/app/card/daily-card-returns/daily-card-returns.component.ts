import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-daily-card-returns',
  templateUrl: './daily-card-returns.component.html',
  styleUrls: ['./daily-card-returns.component.css'],
})
export class DailyCardReturnsComponent implements OnInit {
  clients?: Card[];
  employees: Employee[] = [];
  today = this.time.todaysDateMonthDayYear();
  todayFrench = this.time.convertDateToDayMonthYear(this.today);
  dailyPayments?: Filtered[] = [];
  dailyPaymentsCopy?: Filtered[] = [];
  dailyPaymentsNames: string[] = [];
  dailyPamentsAmount: string[] = [];
  trackingIds: string[] = [];
  searchControl = new FormControl();

  /** ▼▼▼  NEW state for date navigation & totals */
  requestDate: string = this.time.getTodaysDateYearMonthDay(); // yyyy-MM-dd
  requestDateCorrectFormat = this.today; // MM-DD-YYYY
  frenchDate = this.todayFrench;

  totalGivenDate = '0'; // running total FC     – NEW
  numberOfPeople = '0'; // count of rows        – NEW

  /** ─────────────────────────────────────── */
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService
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
        this.dailyPayments = results;
      });
  }

  retrieveClients(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.clients = data;
      this.addIdToFilterItems();
      // this.extractTodayPayments();
      this.extractPaymentsForDay();
    });
  }

  addIdToFilterItems() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
    }
  }
  /** runs each time user changes the date picker */
  onDateChange() {
    // NEW
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );

    this.dailyPayments = [];
    this.dailyPaymentsCopy = [];
    this.totalGivenDate = '0';
    this.numberOfPeople = '0';

    this.extractPaymentsForDay(); // renamed helper
  }

  private extractPaymentsForDay() {
    // NEW (was extractTodayPayments)
    if (!this.clients?.length) return;

    const keyWanted = this.requestDateCorrectFormat; // MM-DD-YYYY

    this.dailyPayments = [];
    this.dailyPaymentsCopy = [];
    this.totalGivenDate = '0';
    this.numberOfPeople = '0';

    for (const client of this.clients) {
      const entries = client.withdrawal
        ? Object.entries(client.withdrawal)
        : [];

      const sameDay = Object.fromEntries(
        entries.filter(([k]) => k.startsWith(keyWanted))
      );
      if (!Object.keys(sameDay).length) continue;

      this.fillDailyPayment(
        client,
        Object.values(sameDay),
        Object.keys(sameDay)
      );
    }

    /* after filling  */
    this.numberOfPeople = this.dailyPayments.length.toString();
    this.dailyPayments.forEach(
      (p) =>
        (this.totalGivenDate = (
          Number(this.totalGivenDate) + Number(p.amount)
        ).toString())
    );

    /* keep existing sort */
    this.dailyPayments.sort(
      (a, b) =>
        this.time.parseDate(b.time).getTime() -
        this.time.parseDate(a.time).getTime()
    );
    this.dailyPaymentsCopy = [...this.dailyPayments];
  }

  fillDailyPayment(client: Client, values: string[], keys: string[]) {
    let i = 0;
    for (let v of values) {
      let middleName = client.middleName === undefined ? '' : client.middleName;
      let filt = {
        firstName: client.firstName,
        lastName: client.lastName,
        middleName: middleName,
        amount: v,
        time: keys[i++],
        timeFormatted: this.time.convertDateToDesiredFormat(keys[i - 1]),
        employee: client.employee,
        trackingId: client.trackingId,
      };

      if (Number(v) > 0) {
        this.dailyPayments?.push(filt);
        this.dailyPaymentsCopy?.push(filt);
      }
    }

    // Sort them
    this.dailyPayments!.sort(
      (a, b) =>
        this.time.parseDate(b.time).getTime() -
        this.time.parseDate(a.time).getTime()
    );
    this.dailyPaymentsCopy!.sort(
      (a, b) =>
        this.time.parseDate(b.time).getTime() -
        this.time.parseDate(a.time).getTime()
    );
  }
  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.dailyPaymentsCopy!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.dailyPaymentsCopy);
    }
  }
}

export class Filtered {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  date?: string;
  amount?: string;
  time?: string;
  timeFormatted?: string;
  employee?: Employee;
  trackingId?: string;
}
