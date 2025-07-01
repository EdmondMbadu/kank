import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-daily-fees',
  templateUrl: './daily-fees.component.html',
  styleUrls: ['./daily-fees.component.css'],
})
export class DailyFeesComponent implements OnInit {
  clients?: Client[];
  employees: Employee[] = [];
  today = this.time.todaysDateMonthDayYear();
  todayFrench = this.time.convertDateToDayMonthYear(this.today);
  applicationFeePayments?: Filtered[] = [];
  membershipFeePayments: Filtered[] = [];
  applicationFeePaymentsCopy?: Filtered[] = [];
  membershipFeePaymentsCopy?: Filtered[] = [];

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
        this.applicationFeePayments = results;
      });
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = [];
      this.clients = data;
      this.retrieveEmployees();
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.addIdToFilterItems();
      this.extractTodayApplicationFeePayments();
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

  extractTodayApplicationFeePayments() {
    this.trackingIds = [];
    for (let client of this.clients!) {
      if (
        client.applicationFeePayments !== undefined ||
        client.membershipFeePayments !== undefined
      ) {
        const filteredAppFees = Object.entries(
          client.applicationFeePayments || {}
        ).filter(([key, value]) =>
          key.startsWith(this.requestDateCorrectFormat)
        );
        const filteredMemFees = Object.entries(
          client.membershipFeePayments || {}
        ).filter(([key, value]) =>
          key.startsWith(this.requestDateCorrectFormat)
        );

        const timesSet = new Set<string>();
        for (const [key, value] of filteredAppFees) {
          timesSet.add(key);
        }
        for (const [key, value] of filteredMemFees) {
          timesSet.add(key);
        }

        for (const time of timesSet) {
          const appFee = client.applicationFeePayments?.[time];
          const memFee = client.membershipFeePayments?.[time];
          const appFeeValue = Number(appFee || 0);
          const memFeeValue = Number(memFee || 0);

          if (appFeeValue >= 0 && memFeeValue >= 0) {
            // Both fees are positive, include in the output
            let middleName =
              client.middleName === undefined ? '' : client.middleName;
            let filtAppFee = {
              firstName: client.firstName,
              lastName: client.lastName,
              middleName: middleName,
              amount: appFeeValue.toString(),
              time: time,
              employee: client.employee,
              trackingId: client.trackingId,
            };
            this.applicationFeePayments?.push(filtAppFee);
            this.applicationFeePaymentsCopy?.push(filtAppFee);

            let filtMemFee = {
              firstName: client.firstName,
              lastName: client.lastName,
              middleName: middleName,
              amount: memFeeValue.toString(),
              time: time,
              employee: client.employee,
              trackingId: client.trackingId,
            };
            this.membershipFeePayments?.push(filtMemFee);
            this.totalGivenDate = (
              Number(memFeeValue) +
              Number(appFeeValue) +
              Number(this.totalGivenDate)
            ).toString();
            this.membershipFeePaymentsCopy?.push(filtMemFee);
          }
        }
      }
    }
    this.numberOfPeople = this.membershipFeePayments.length.toString();

    // sort them
    this.applicationFeePayments!.sort(
      (a, b) =>
        this.parseDate(b.time).getTime() - this.parseDate(a.time).getTime()
    );
    this.membershipFeePayments!.sort(
      (a, b) =>
        this.parseDate(b.time).getTime() - this.parseDate(a.time).getTime()
    );
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
        this.applicationFeePaymentsCopy!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.applicationFeePaymentsCopy);
    }
  }
  findDailyFees() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );
    // Reinitialize daily payments and related properties

    this.totalGivenDate = '0'; // Assuming it's a string representation of the total amount
    this.numberOfPeople = '0';
    this.membershipFeePayments = [];
    this.membershipFeePaymentsCopy = [];
    this.applicationFeePayments = [];
    this.applicationFeePaymentsCopy = [];
    this.extractTodayApplicationFeePayments();
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
