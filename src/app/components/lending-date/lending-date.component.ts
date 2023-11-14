import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-lending-date',
  templateUrl: './lending-date.component.html',
  styleUrls: ['./lending-date.component.css'],
})
export class LendingDateComponent {
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
      this.addIds();
      this.filterPayments();
    });
  }
  addIds() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
      this.clients![i].frenchPaymentDay =
        this.frenchPaymentDays[`${this.clients![i].paymentDay}`];
    }
  }

  filterPayments() {
    let day = this.time.getDayOfWeek(this.today);
    for (let client of this.clients!) {
      if (client.paymentDay === day) {
        // console.log(' clients payment', client.payments);
        this.todayPayments.push(client);
      }
    }
  }

  search(value: string) {
    if (value) {
      const clientsWithPaymentsOnDate = this.getClientsByDate(value);
      this.totalGivenDate = this.compute.computeTotalLoanPerDate(
        clientsWithPaymentsOnDate
      );
      return of(clientsWithPaymentsOnDate);
    } else {
      this.totalGivenDate = this.compute.computeTotalLoanPerDate([]);
      return of([]);
    }
  }

  getClientsByDate(date: string) {
    return this.clients!.filter((client) => {
      return client.debtCycleStartDate!.startsWith(date);
    }).map((client) => {
      return {
        firstName: client.firstName,
        lastName: client.lastName,
        middleName: client.middleName,
        loanAmount: client.loanAmount,
        date: client.debtCycleStartDate,
        trackingId: client.trackingId,
        amountToPay: client.amountToPay,
        amountPaid: client.amountPaid,
        paymentPeriodRange: client.paymentPeriodRange,
      };
    });
  }
}

export class Filtered {
  firstName?: string;
  lastName?: string;
  date?: string;
  loanAmount?: string;
  middleName?: string;

  trackingId?: string;
}
