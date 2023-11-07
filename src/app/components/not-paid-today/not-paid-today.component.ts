import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-not-paid-today',
  templateUrl: './not-paid-today.component.html',
  styleUrls: ['./not-paid-today.component.css'],
})
export class NotPaidTodayComponent {
  clients?: Client[];
  shouldPayToday: Client[] = [];
  haveNotPaidToday: Client[] = [];
  totalGivenDate: number = 0;
  paidToday: Client[] = [];
  today = this.time.todaysDateMonthDayYear();
  filteredItems?: Client[];
  dailyPaymentsNames: string[] = [];
  dailyPamentsAmount: string[] = [];
  trackingIds: string[] = [];
  searchControl = new FormControl();
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {
    this.retrieveClients();
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.filteredItems = data;
      this.addIdToFilterItems();
      this.extractTodayPayments();
      this.filterPayments();
      this.findThoseWhoHaveNotPaidToday();
      this.totalGivenDate = this.compute.computeExpectedPerDate(
        this.haveNotPaidToday
      );
    });
  }

  addIdToFilterItems() {
    for (let i = 0; i < this.filteredItems!.length; i++) {
      this.filteredItems![i].trackingId = `${i}`;
    }
  }

  extractTodayPayments() {
    this.dailyPamentsAmount = [];
    this.dailyPaymentsNames = [];
    this.paidToday = [];
    this.trackingIds = [];
    for (let client of this.clients!) {
      const filteredDict = Object.fromEntries(
        Object.entries(client.payments!).filter(([key, value]) =>
          key.startsWith(this.today)
        )
      );
      const filteredValues = Object.values(filteredDict);
      if (filteredValues.length !== 0) {
        this.paidToday.push(client);
        this.fillDailyPayment(client, filteredValues);
      }
    }
  }
  findThoseWhoHaveNotPaidToday() {
    this.haveNotPaidToday = [];
    for (let c of this.shouldPayToday) {
      if (
        this.paidToday.indexOf(c) === -1 &&
        Number(c.amountToPay) - Number(c.amountPaid) > 0 &&
        !c.debtCycleStartDate?.startsWith(this.today)
      ) {
        c.minPayment = (
          Number(c.amountToPay) / Number(c.paymentPeriodRange)
        ).toString();
        this.haveNotPaidToday.push(c);
      }
    }
    console.log('those who have not paid today yet are', this.haveNotPaidToday);
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
    let day = this.time.getDayOfWeek(this.today);
    for (let client of this.clients!) {
      if (client.paymentDay === day) {
        // console.log(' clients payment', client.payments);
        this.shouldPayToday.push(client);
      }
    }
  }
}
