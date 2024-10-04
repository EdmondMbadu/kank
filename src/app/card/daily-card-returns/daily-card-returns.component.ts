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
      this.extractTodayPayments();
    });
  }

  addIdToFilterItems() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
    }
  }

  extractTodayPayments() {
    this.dailyPamentsAmount = [];
    this.dailyPaymentsNames = [];
    this.trackingIds = [];
    for (let client of this.clients!) {
      // Ensure client.payments and client.previousPayments are not undefined or null
      const paymentsEntries = client.withdrawal
        ? Object.entries(client.withdrawal)
        : [];

      // Combine entries from both payments and previousPayments
      const combinedEntries = [...paymentsEntries];

      // Filter the combined entries
      const filteredDict = Object.fromEntries(
        combinedEntries.filter(([key, value]) => key.startsWith(this.today))
      );

      const filteredValues = Object.values(filteredDict);
      const filteredKeys = Object.keys(filteredDict);
      if (filteredValues.length !== 0) {
        this.fillDailyPayment(client, filteredValues, filteredKeys);
      }
    }
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
