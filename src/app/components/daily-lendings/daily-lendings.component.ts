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
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  numberOfPeople: string = '0';
  totalGivenDate: string = '0';
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
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
      if (client.debtCycleStartDate === this.requestDateCorrectFormat) {
        this.filteredItems!.push(client);
        this.filteredItemsCopy?.push(client);
        this.totalGivenDate = (
          Number(client.loanAmount) + Number(this.totalGivenDate)
        ).toString();
      }
    }
    this.numberOfPeople = this.filteredItems.length.toString();
  }
  findDailyLending() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );
    // Reinitialize daily payments and related properties

    this.totalGivenDate = '0'; // Assuming it's a string representation of the total amount
    this.numberOfPeople = '0';
    this.filteredItems = [];
    this.filteredItemsCopy = [];
    this.extractTodayLendings();
  }
}
