import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-daily-returns',
  templateUrl: './daily-returns.component.html',
  styleUrls: ['./daily-returns.component.css'],
})
export class DailyReturnsComponent implements OnInit {
  clients?: Client[];
  employees: Employee[] = [];
  today = this.time.todaysDateMonthDayYear();
  todayFrench = this.time.convertDateToDayMonthYear(this.today);
  applicationFeePayments?: Filtered[] = [];
  membershipFeePayments: Filtered[] = [];
  applicationFeePaymentsCopy?: Filtered[] = [];
  membershipFeePaymentsCopy?: Filtered[] = [];

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

  // extractTodayApplicationFeePayments() {
  //   this.trackingIds = [];
  //   for (let client of this.clients!) {
  //     if (client.applicationFeePayments !== undefined) {
  //       const filteredDict = Object.fromEntries(
  //         Object.entries(client.applicationFeePayments!).filter(
  //           ([key, value]) => key.startsWith(this.today)
  //         )
  //       );
  //       const filteredDictMembership = Object.fromEntries(
  //         Object.entries(client.membershipFeePayments!).filter(([key, value]) =>
  //           key.startsWith(this.today)
  //         )
  //       );
  //       // console.log('all current clients', filteredDict);
  //       const filterdKeys = Object.keys(filteredDict);
  //       const filterdKeysMembership = Object.keys(filteredDictMembership);
  //       // console.log('all keys', filterdKeys);
  //       const filteredValues = Object.values(filteredDict);
  //       const filteredValuesMembership = Object.values(filteredDictMembership);
  //       // console.log('all values', filteredValues);
  //       if (filteredValues.length !== 0) {
  //         this.fillDailyApplicationFeePayment(
  //           client,
  //           filteredValues,
  //           filterdKeys
  //         );
  //         this.fillDailyMembershipFeePayment(
  //           client,
  //           filteredValuesMembership,
  //           filterdKeysMembership
  //         );
  //       }
  //     }
  //   }
  // }

  // fillDailyApplicationFeePayment(
  //   client: Client,
  //   values: string[],
  //   keys: string[]
  // ) {
  //   let i = 0;
  //   for (let v of values) {
  //     let middleName = client.middleName === undefined ? '' : client.middleName;
  //     let filt = {
  //       firstName: client.firstName,
  //       lastName: client.lastName,
  //       middleName: middleName,
  //       amount: v,
  //       time: keys[i++],
  //       employee: client.employee,
  //       trackingId: client.trackingId,
  //     };

  //     if (Number(v) <= 0) {
  //       this.applicationFeePayments?.push(filt);
  //       this.applicationFeePaymentsCopy?.push(filt);
  //     }
  //   }

  //   // sort them
  //   this.applicationFeePayments!.sort(
  //     (a, b) =>
  //       this.parseDate(b.time).getTime() - this.parseDate(a.time).getTime()
  //   );
  //   this.applicationFeePayments!.sort(
  //     (a, b) =>
  //       this.parseDate(b.time).getTime() - this.parseDate(a.time).getTime()
  //   );
  //   // console.log('All payments', this.dailyPayments);
  // }

  // fillDailyMembershipFeePayment(
  //   client: Client,
  //   values: string[],
  //   keys: string[]
  // ) {
  //   let i = 0;
  //   for (let v of values) {
  //     let middleName = client.middleName === undefined ? '' : client.middleName;
  //     let filt = {
  //       firstName: client.firstName,
  //       lastName: client.lastName,
  //       middleName: middleName,
  //       amount: v,
  //       time: keys[i++],
  //       employee: client.employee,
  //       trackingId: client.trackingId,
  //     };

  //     if (Number(v) <= 0) {
  //       this.membershipFeePayments?.push(filt);
  //       this.membershipFeePaymentsCopy?.push(filt);
  //     }
  //   }

  //   // sort them
  //   this.membershipFeePayments!.sort(
  //     (a, b) =>
  //       this.parseDate(b.time).getTime() - this.parseDate(a.time).getTime()
  //   );
  //   this.applicationFeePayments!.sort(
  //     (a, b) =>
  //       this.parseDate(b.time).getTime() - this.parseDate(a.time).getTime()
  //   );
  //   // console.log('All payments', this.dailyPayments);
  // }

  extractTodayApplicationFeePayments() {
    this.trackingIds = [];
    for (let client of this.clients!) {
      if (
        client.applicationFeePayments !== undefined ||
        client.membershipFeePayments !== undefined
      ) {
        const filteredAppFees = Object.entries(
          client.applicationFeePayments || {}
        ).filter(([key, value]) => key.startsWith(this.today));
        const filteredMemFees = Object.entries(
          client.membershipFeePayments || {}
        ).filter(([key, value]) => key.startsWith(this.today));

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

          if (appFeeValue <= 0 && memFeeValue <= 0) {
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
            this.membershipFeePaymentsCopy?.push(filtMemFee);
          }
        }
      }
    }

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
