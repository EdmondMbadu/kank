import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-request-today',
  templateUrl: './request-today.component.html',
  styleUrls: ['./request-today.component.css'],
})
export class RequestTodayComponent implements OnInit {
  clients?: Client[];
  cards: Card[] = [];
  employees: Employee[] = [];
  today = this.time.todaysDateMonthDayYear();
  total: string = '';
  totalCard: string = '';

  clientsRequestLending: Client[] = [];
  clientsRequestSavings: Client[] = [];
  clientsRequestCard: Card[] = [];
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  requestDate: string = this.time.convertToYearMonthDay(this.today);
  requestDateRigthFormat: string = this.today;

  trackingIds: string[] = [];
  searchControl = new FormControl();
  searchControlSavings = new FormControl();
  searchControlCard = new FormControl();
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService
  ) {
    this.retrieveClients();
    this.retrieveClientsCard();
  }
  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => this.search(value))
      )
      .subscribe((results) => {
        this.clientsRequestLending = results;
      });
    this.searchControlSavings.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => this.searchSavings(value))
      )
      .subscribe((results) => {
        this.clientsRequestSavings = results;
      });
    this.searchControlCard.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => this.searchCard(value))
      )
      .subscribe((results) => {
        this.clientsRequestCard = results;
      });
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.retrieveEmployees();
    });
  }
  retrieveClientsCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.cards = data;
      this.addIdToFilterItemsCard();
      this.extractTCard();
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.addIdToFilterItems();
      this.extractTodayPayments();
      // a little weird. angular is really with the flow
      this.extractTCard();
    });
  }
  addIdToFilterItemsCard() {
    let total = 0;
    for (let i = 0; i < this.cards!.length; i++) {
      this.cards![i].trackingId = `${i}`;
      // total += Number(this.cards![i].debtLeft);
    }
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

  otherDate() {
    console.log('date', this.requestDate);
    this.requestDateRigthFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateRigthFormat
    );
    this.retrieveClients();
    this.retrieveClientsCard();
  }

  extractTodayPayments() {
    this.trackingIds = [];
    this.clientsRequestLending = [];
    this.clientsRequestSavings = [];
    this.total = '0';
    for (let client of this.clients!) {
      if (
        client.requestStatus !== undefined &&
        client.requestType === 'lending' &&
        client.requestDate === this.requestDateRigthFormat
      ) {
        this.clientsRequestLending.push(client);
        this.total = (
          Number(this.total) + Number(client.requestAmount)
        ).toString();
      } else if (
        client.requestStatus !== undefined &&
        client.requestType === 'savings' &&
        client.requestDate === this.requestDateRigthFormat
      ) {
        this.clientsRequestSavings.push(client);
        this.total = (
          Number(this.total) + Number(client.requestAmount)
        ).toString();
      }
    }
  }
  extractTCard() {
    this.trackingIds = [];
    // this.clientsRequestLending = [];
    this.clientsRequestCard = [];
    for (let client of this.cards!) {
      if (
        client.requestStatus !== undefined &&
        client.requestType === 'card' &&
        client.requestDate === this.requestDateRigthFormat
      ) {
        this.clientsRequestCard.push(client);
        console.log('card request amount', client.requestAmount);
        this.total = (
          Number(this.total) + Number(client.requestAmount)
        ).toString();
      }
    }
  }

  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.clientsRequestLending!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.clientsRequestLending);
    }
  }
  searchSavings(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.clientsRequestSavings!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.clientsRequestSavings);
    }
  }
  searchCard(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.clientsRequestCard!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.clientsRequestCard);
    }
  }
}
