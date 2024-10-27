import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-daily-savings-returns',
  templateUrl: './daily-savings-returns.component.html',
  styleUrls: ['./daily-savings-returns.component.css'],
})
export class DailySavingsReturnsComponent implements OnInit {
  clients?: Client[];
  employees: Employee[] = [];
  today = this.time.todaysDateMonthDayYear();
  todayFrench = this.time.convertDateToDayMonthYear(this.today);
  dailyPayments?: Filtered[] = [];
  dailyPaymentsCopy?: Filtered[] = [];

  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  numberOfPeople: string = '0';
  totalGivenDate: string = '0';
  frenchDate = this.time.convertDateToDayMonthYear(this.today);

  trackingIds: string[] = [];
  searchControl = new FormControl();
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private data: DataService
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
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.retrieveEmployees();
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.addIdToFilterItems();
      this.extractTodaySavingReturns();
    });
  }
  addIdToFilterItems() {
    for (
      let i = 0;
      this.clients !== undefined && i < this.clients!.length;
      i++
    ) {
      this.clients![i].trackingId = `${i}`;
      let emp = this.employees.find(
        (element) => element.uid === this.clients![i].agent
      );
      this.clients![i].employee = emp;
    }
  }

  extractTodaySavingReturns() {
    this.trackingIds = [];
    for (let client of this.clients!) {
      // Ensure client.savingsPayments and client.previousSavingsPayments are not undefined or null
      const savingsPaymentsEntries = client.savingsPayments
        ? Object.entries(client.savingsPayments)
        : [];
      const previousSavingsPaymentsEntries = client.previousSavingsPayments
        ? Object.entries(client.previousSavingsPayments)
        : [];

      // Combine entries from both savingsPayments and previousSavingsPayments
      const combinedEntries = [
        ...savingsPaymentsEntries,
        ...previousSavingsPaymentsEntries,
      ];

      // Filter the combined entries
      const filteredDict = Object.fromEntries(
        combinedEntries.filter(([key, value]) =>
          key.startsWith(this.requestDateCorrectFormat)
        )
      );

      const filteredKeys = Object.keys(filteredDict);
      const filteredValues = Object.values(filteredDict);
      if (filteredValues.length !== 0) {
        this.fillDailySavingReturns(client, filteredValues, filteredKeys);
      }
    }
  }

  fillDailySavingReturns(client: Client, values: string[], keys: string[]) {
    let i = 0;
    for (let v of values) {
      let middleName = client.middleName === undefined ? '' : client.middleName;
      let filt = {
        firstName: client.firstName,
        lastName: client.lastName,
        middleName: middleName,
        amount: v,
        time: keys[i++],
        employee: client.employee,
        trackingId: client.trackingId,
      };

      if (Number(v) < 0) {
        this.dailyPayments?.push(filt);
        this.dailyPaymentsCopy?.push(filt);
        this.totalGivenDate = (
          Number(this.totalGivenDate) - Number(v)
        ).toString();
      }
    }
    this.dailyPayments = this.data.removeDuplicates(this.dailyPayments!);
    this.dailyPaymentsCopy = this.data.removeDuplicates(
      this.dailyPaymentsCopy!
    );
    this.numberOfPeople = this.dailyPayments!.length.toString();

    // sort them
    this.dailyPayments!.sort(
      (a, b) =>
        this.parseDate(b.time).getTime() - this.parseDate(a.time).getTime()
    );
    this.dailyPaymentsCopy!.sort(
      (a, b) =>
        this.parseDate(b.time).getTime() - this.parseDate(a.time).getTime()
    );
    // console.log('All payments', this.dailyPayments);
  }
  parseDate(timeStr: any) {
    const parts = timeStr.split('-');
    // The parts array will have the format [month, day, year, hour, minute, second]
    return new Date(
      parts[2],
      parts[0] - 1,
      parts[1],
      parts[3],
      parts[4],
      parts[5]
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
  findDailySavingReturns() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );
    // Reinitialize daily payments and related properties
    this.dailyPayments = [];
    this.dailyPaymentsCopy = [];
    this.totalGivenDate = '0'; // Assuming it's a string representation of the total amount
    this.numberOfPeople = '0';

    this.extractTodaySavingReturns();
  }
}

export class Filtered {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  date?: string;
  time?: string;
  amount?: string;
  employee?: Employee;
  trackingId?: string;
}
