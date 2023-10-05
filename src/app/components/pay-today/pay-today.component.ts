import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-pay-today',
  templateUrl: './pay-today.component.html',
  styleUrls: ['./pay-today.component.css'],
})
export class PayTodayComponent {
  clients?: Client[];
  todayPayments: Client[] = [];
  today = this.time.todaysDateMonthDayYear();
  trackingIds: string[] = [];
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
      this.addIds();
      this.filterTodayPayments();
    });
  }
  addIds() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
    }
  }

  filterTodayPayments() {
    let day = this.time.getDayOfWeek(this.today);
    for (let client of this.clients!) {
      if (client.paymentDay === day) {
        console.log('hello');
        this.todayPayments.push(client);
      }
    }
  }
}
