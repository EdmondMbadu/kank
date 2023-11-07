import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-pay-today',
  templateUrl: './pay-today.component.html',
  styleUrls: ['./pay-today.component.css'],
})
export class PayTodayComponent implements OnInit {
  clients?: Client[];
  totalGivenDate: number = 0;
  todayPayments: Client[] = [];
  searchControl = new FormControl();
  frenchPaymentDays: { [key: string]: string } = {
    Monday: 'Lundi',
    Tuesday: 'Mardi',
    Wednesday: 'Mercredi',
    Thursday: 'Jeudi',
    Friday: 'Vendredi',
  };
  today = this.time.todaysDateMonthDayYear();
  filteredItems?: Client[];
  trackingIds: string[] = [];
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {
    this.retrieveClients();
  }

  ngOnInit(): void {
    this.frenchPaymentDays['Monday'] = 'Lundi';
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
      this.filteredItems = data;
      this.addIds();
      this.filterTodayPayments();
    });
  }
  addIds() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
      this.clients![i].frenchPaymentDay =
        this.frenchPaymentDays[`${this.clients![i].paymentDay}`];
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

  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      this.totalGivenDate = this.compute.computeExpectedPerDate(
        this.clients!.filter(
          (client) =>
            client.paymentDay?.toLowerCase().includes(lowerCaseValue) ||
            client.frenchPaymentDay?.toLowerCase().includes(lowerCaseValue)
        )
      );
      return of(
        this.clients!.filter(
          (client) =>
            client.paymentDay?.toLowerCase().includes(lowerCaseValue) ||
            client.frenchPaymentDay?.toLowerCase().includes(lowerCaseValue)
        )
      );
    } else {
      this.totalGivenDate = this.compute.computeExpectedPerDate([]);
      return of(this.clients);
    }
  }
}
