import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-daily-payments',
  templateUrl: './daily-payments.component.html',
  styleUrls: ['./daily-payments.component.css'],
})
export class DailyPaymentsComponent {
  clients?: Client[];
  today = this.time.todaysDateMonthDayYear();
  filteredItems?: Client[];
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

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.filteredItems = data;
      this.addIdToFilterItems();
      this.extractTodayPayments();
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
    this.trackingIds = [];
    for (let client of this.clients!) {
      const filteredDict = Object.fromEntries(
        Object.entries(client.payments!).filter(([key, value]) =>
          key.startsWith(this.today)
        )
      );
      const filteredValues = Object.values(filteredDict);
      if (filteredValues.length !== 0) {
        this.fillDailyPayment(client, filteredValues);
      }
    }
  }

  fillDailyPayment(client: Client, values: string[]) {
    for (let v of values) {
      this.dailyPaymentsNames.push(`${client.firstName} ${client.lastName}`);
      this.dailyPamentsAmount.push(v);
      this.trackingIds.push(client.trackingId!);
    }
  }
}
