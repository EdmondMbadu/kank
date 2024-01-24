import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-paid-date',
  templateUrl: './paid-date.component.html',
  styleUrls: ['./paid-date.component.css'],
})
export class PaidDateComponent {
  clients?: Client[];
  totalGivenDate: number = 0;
  todayPayments: Client[] = [];
  numberOfPeople: number = 0;
  searchControl = new FormControl();

  today = this.time.todaysDateMonthDayYear();
  filteredItems?: Filtered[];
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
      this.addIds();
      this.filterPayments();
    });
  }
  addIds() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
    }
  }

  filterPayments() {
    let day = this.time.getDayOfWeek(this.today);
    for (let client of this.clients!) {
      if (client.paymentDay === day) {
        this.todayPayments.push(client);
      }
    }
  }

  search(value: string) {
    if (value) {
      const clientsWithPaymentsOnDate = this.getClientsByDate(value);
      this.totalGivenDate = this.totalPerDate(clientsWithPaymentsOnDate);
      this.numberOfPeople = clientsWithPaymentsOnDate.length;
      return of(clientsWithPaymentsOnDate);
    } else {
      this.totalGivenDate = this.compute.computeExpectedPerDate([]);
      this.numberOfPeople = 0;
      return of([]);
    }
  }

  getClientsByDate(date: string) {
    let clientsWithAllPayments: any = [];

    this.clients!.forEach((client) => {
      const paymentDates = Object.keys(client.payments!).filter((paymentDate) =>
        paymentDate.startsWith(date)
      );

      paymentDates.forEach((paymentDate) => {
        clientsWithAllPayments.push({
          firstName: client.firstName,
          lastName: client.lastName,
          middleName: client.middleName,
          date: paymentDate,
          amount: client.payments![paymentDate],
          trackingId: client.trackingId,
          amountToPay: client.amountToPay,
          amountPaid: client.amountPaid,
          paymentPeriodRange: client.paymentPeriodRange,
        });
      });
    });

    return clientsWithAllPayments;
  }
  totalPerDate(clients: Filtered[]) {
    let total = 0;
    for (let client of clients) {
      total += Number(client.amount);
    }
    return total;
  }
}

export class Filtered {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  date?: string;
  amount?: string;
  trackingId?: string;
}
