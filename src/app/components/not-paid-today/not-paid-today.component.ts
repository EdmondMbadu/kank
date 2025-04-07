import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { min } from 'rxjs';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-not-paid-today',
  templateUrl: './not-paid-today.component.html',
  styleUrls: ['./not-paid-today.component.css'],
})
export class NotPaidTodayComponent {
  clients?: Client[];
  shouldPayToday: Client[] = [];
  employees: Employee[] = [];
  haveNotPaidToday: Client[] = [];
  totalGivenDate: number = 0;
  paidToday: Client[] = [];
  numberOfPeople: number = 0;
  today = this.time.todaysDateMonthDayYear();
  filteredItems?: Client[];
  dailyPaymentsNames: string[] = [];
  dailyPamentsAmount: string[] = [];
  trackingIds: string[] = [];
  searchControl = new FormControl();

  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private fns: AngularFireFunctions,
    private data: DataService
  ) {
    this.retrieveClients();
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.retrieveEmployees();
      this.filteredItems = data;

      this.extractTodayPayments();
      this.filterPayments();
      this.findThoseWhoHaveNotPaidToday();
      this.totalGivenDate = this.compute.computeExpectedPerDate(
        this.haveNotPaidToday
      );
      this.numberOfPeople = this.haveNotPaidToday.length;
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.addIdToFilterItems();
    });
  }

  addIdToFilterItems() {
    for (let i = 0; i < this.filteredItems!.length; i++) {
      this.filteredItems![i].trackingId = `${i}`;
      let emp = this.employees.find(
        (element) => element.uid === this.filteredItems![i].agent
      );
      this.filteredItems![i].employee = emp;
    }
  }

  extractTodayPayments() {
    this.dailyPamentsAmount = [];
    this.dailyPaymentsNames = [];
    this.paidToday = [];
    this.trackingIds = [];
    if (this.clients) {
      for (let client of this.clients!) {
        const filteredDict = client.payments
          ? Object.fromEntries(
              Object.entries(client.payments).filter(([key, value]) =>
                key.startsWith(this.requestDateCorrectFormat)
              )
            )
          : {};
        const filteredValues = Object.values(filteredDict);
        if (filteredValues.length !== 0) {
          this.paidToday.push(client);
          this.fillDailyPayment(client, filteredValues);
        }
      }
    }
  }
  findThoseWhoHaveNotPaidToday() {
    this.haveNotPaidToday = [];
    if (this.shouldPayToday) {
      for (let c of this.shouldPayToday) {
        const isAlive =
          c.vitalStatus === undefined ||
          c.vitalStatus === '' ||
          c.vitalStatus.toLowerCase() === 'vivant';
        // return isAlive && Number(c.debtLeft) > 0;
        if (
          this.paidToday.indexOf(c) === -1 &&
          isAlive &&
          Number(c.debtLeft) > 0 &&
          !c.debtCycleStartDate?.startsWith(this.requestDateCorrectFormat) &&
          this.didClientStartThisWeek(c)
        ) {
          c.minPayment = (
            Number(c.amountToPay) / Number(c.paymentPeriodRange)
          ).toString();
          this.haveNotPaidToday.push(c);
        }
      }
    }
    console.log('have not paid today', this.haveNotPaidToday);
  }
  fillDailyPayment(client: Client, values: string[]) {
    for (let v of values) {
      this.dailyPaymentsNames.push(`${client.firstName} ${client.lastName}`);
      this.dailyPamentsAmount.push(v);
      this.trackingIds.push(client.trackingId!);
    }
  }
  filterPayments() {
    this.shouldPayToday = [];
    let day = this.time.getDayOfWeek(this.requestDateCorrectFormat);
    for (let client of this.clients!) {
      if (client.paymentDay === day) {
        this.shouldPayToday.push(client);
      }
    }
  }

  didClientStartThisWeek(client: Client) {
    const convertToDateCompatibleFormat = (dateStr: string) => {
      const [month, day, year] = dateStr.split('-');
      return `${year}/${month}/${day}`;
    };

    const oneWeekAgo = new Date();
    // watch out for this one. I am not sure. whether it is 7 so I put 6 just in case.
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

    const formattedDebtCycleStartDate = convertToDateCompatibleFormat(
      client.debtCycleStartDate!
    );
    const debtCycleStartDate = new Date(formattedDebtCycleStartDate);

    if (debtCycleStartDate > oneWeekAgo) {
      return false;
    }

    return true;
  }
  findDailyDidNotPay() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );
    this.totalGivenDate = 0; // Assuming it's a string representation of the total amount
    this.numberOfPeople = 0;

    this.retrieveClients();
  }

  // 3) Method to call the Cloud Function
  sendReminders() {
    if (!this.haveNotPaidToday || this.haveNotPaidToday.length === 0) {
      console.log('No clients to remind.');
      return;
    }

    // We only send the fields necessary for the SMS
    const clientsPayload = this.haveNotPaidToday.map((c) => {
      const min = this.data.minimumPayment(c);
      return {
        firstName: c.firstName,
        lastName: c.lastName,
        phoneNumber: c.phoneNumber,
        minPayment: min,
        debtLeft: c.debtLeft,
        savings: c.savings,
      };
    });

    const callable = this.fns.httpsCallable('sendPaymentReminders');
    callable({ clients: clientsPayload }).subscribe({
      next: (result: any) => {
        console.log('Reminder SMS function result:', result);
        alert('Reminders sent successfully!');
      },
      error: (err: any) => {
        console.error('Error calling reminder function', err);
        alert('Error sending reminders. Please try again.');
      },
    });
  }
}
