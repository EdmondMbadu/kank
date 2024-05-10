import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
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
  employees: Employee[] = [];
  totalGivenDate: number = 0;
  numberOfPeople: number = 0;
  searchControl = new FormControl();
  frenchPaymentDays: { [key: string]: string } = {
    Monday: 'Lundi',
    Tuesday: 'Mardi',
    Wednesday: 'Mercredi',
    Thursday: 'Jeudi',
    Friday: 'Vendredi',
    Saturday: 'Samedi',
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
      this.retrieveEmployees();
      this.filteredItems = data;
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.addIds();
    });
  }
  addIds() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
      this.clients![i].frenchPaymentDay =
        this.frenchPaymentDays[`${this.clients![i].paymentDay}`];
      let emp = this.employees.find(
        (element) => element.uid === this.clients![i].agent
      );
      this.clients![i].employee = emp;
    }
  }

  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      let current = this.clients!.filter(
        (client) =>
          client.paymentDay?.toLowerCase().includes(lowerCaseValue) ||
          (client.frenchPaymentDay?.toLowerCase().includes(lowerCaseValue) &&
            Number(client.amountToPay) - Number(client.amountPaid) > 0)
      );
      this.totalGivenDate = this.compute.computeExpectedPerDate(current);
      this.numberOfPeople = current.length;
      return of(current);
    } else {
      this.totalGivenDate = this.compute.computeExpectedPerDate([]);
      this.numberOfPeople = 0;
      return of(this.clients);
    }
  }
}
