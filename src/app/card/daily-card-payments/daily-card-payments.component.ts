import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-daily-card-payments',
  templateUrl: './daily-card-payments.component.html',
  styleUrls: ['./daily-card-payments.component.css'],
})
export class DailyCardPaymentsComponent implements OnInit {
  clients?: Client[];
  employees: Employee[] = [];
  today = this.time.todaysDateMonthDayYear();
  todayFrench = this.time.convertDateToDayMonthYear(this.today);
  dailyPayments?: Filtered[] = [];
  dailyPaymentsCopy?: Filtered[] = [];
  dailyPaymentsNames: string[] = [];
  dailyPamentsAmount: string[] = [];
  trackingIds: string[] = [];
  searchControl = new FormControl();
  totalGivenDate = '0'; // NEW  – sum of all amounts FC
  numberOfPeople = '0'; // NEW  – how many distinct rows

  // ▼▼▼  NEW state for “any day” navigation
  requestDate: string = this.time.getTodaysDateYearMonthDay(); // yyyy-MM-dd
  requestDateCorrectFormat = this.today; // MM-DD-YYYY
  frenchDate = this.todayFrench;
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
      this.clients = [];
      this.clients = data;
      this.addIdToFilterItems();
      // this.extractTodayPayments();
      this.extractPaymentsForDay();
    });
  }

  addIdToFilterItems() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
      let emp = this.employees.find(
        (element) => element.uid === this.clients![i].agent
      );
      this.clients![i].employee = emp;
    }
  }

  /** renamed & generalised */
  private extractPaymentsForDay() {
    if (!this.clients?.length) return;

    const keyWanted = this.requestDateCorrectFormat; // MM-DD-YYYY
    this.dailyPayments = [];
    this.dailyPaymentsCopy = [];
    this.totalGivenDate = '0'; // NEW
    this.numberOfPeople = '0'; // NEW

    for (const client of this.clients) {
      const entries = [
        ...(client.payments ? Object.entries(client.payments) : []),
        ...(client.previousPayments
          ? Object.entries(client.previousPayments)
          : []),
      ];

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
    /* after the loop */
    this.numberOfPeople = this.dailyPayments.length.toString(); // NEW
    this.dailyPayments.forEach(
      (p) =>
        (this.totalGivenDate = (
          Number(this.totalGivenDate) + Number(p.amount)
        ).toString())
    );

    /* sort once at the end */
    this.dailyPayments?.sort(
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

  /** 🔸 runs when the user picks another date */
  onDateChange() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );

    // reload the list for the new day
    this.dailyPayments = [];
    this.dailyPaymentsCopy = [];
    this.extractPaymentsForDay(); // renamed helper
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
