import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-daily-lendings',
  templateUrl: './daily-lendings.component.html',
  styleUrls: ['./daily-lendings.component.css'],
})
export class DailyLendingsComponent {
  clients?: Client[];
  today = this.time.todaysDateMonthDayYear();
  filteredItems?: Client[] = [];
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
      this.extractTodayLendings();
      this.addIdToFilterItems();
    });
  }

  addIdToFilterItems() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
    }
  }

  extractTodayLendings() {
    this.filteredItems = [];
    for (let client of this.clients!) {
      if (client.debtCycleStartDate === this.today) {
        this.filteredItems!.push(client);
      }
    }
  }
}
