import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-daily-lendings',
  templateUrl: './daily-lendings.component.html',
  styleUrls: ['./daily-lendings.component.css'],
})
export class DailyLendingsComponent implements OnInit {
  clients?: Client[];
  today = this.time.todaysDateMonthDayYear();
  todayFrench = this.time.convertDateToDayMonthYear(this.today);
  filteredItems?: Client[] = [];
  filteredItemsCopy?: Client[] = [];
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
        this.filteredItems = results;
      });
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.extractTodayLendings();
      this.addIdToFilterItems();
    });
  }

  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.filteredItemsCopy!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.filteredItemsCopy);
    }
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
        this.filteredItemsCopy?.push(client);
      }
    }
  }
}
