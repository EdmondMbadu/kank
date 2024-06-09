import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-not-paid',
  templateUrl: './not-paid.component.html',
  styleUrls: ['./not-paid.component.css'],
})
export class NotPaidComponent implements OnInit {
  employees: Employee[] = [];
  clients?: Client[];
  searchControl = new FormControl();
  totalGivenDate: number = 0;
  numberofPeopleWhodidNotPay: number = 0;
  haveNotPaid?: Client[] = [];
  haveNotPaidCopy?: Client[] = [];
  validStartDate: boolean = true;
  validEndDate: boolean = true;
  datesRange: string[] = [];
  startDate: string = '';
  endDate: string = '';
  constructor(
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
        this.haveNotPaid = results;
      });
  }

  searchThoseWhoDidNotPayPerInterval() {
    this.validStartDate = this.time.isDateInRange(this.startDate);
    this.validEndDate = this.time.isDateInRange(this.endDate);

    if (
      this.validStartDate &&
      this.validEndDate &&
      this.time.isEndDateGreater(this.startDate, this.endDate)
    ) {
      this.datesRange = this.time.getDatesInRange(this.startDate, this.endDate);
      this.haveNotPaid = this.time.filterClientsByPaymentDates(
        this.clients!,
        this.datesRange
      );
      this.haveNotPaidCopy = structuredClone(this.haveNotPaid);
      this.totalGivenDate = this.compute.computeExpectedPerDate(
        this.haveNotPaid
      );
      console.log('have not paid given interval here', this.haveNotPaid);
      this.numberofPeopleWhodidNotPay = this.haveNotPaid.length;
    } else {
      alert('Les dates ne sont pas valides. Entrez des date valides.');
    }
  }
  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      // filter out clients that have not debt( registered) or have finished their debts.

      this.retrieveEmployees();
    });
  }

  addId() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
      let emp = this.employees.find(
        (element) => element.uid === this.clients![i].agent
      );
      this.clients![i].employee = emp;
    }
    this.clients = this.clients!.filter(
      (client: Client) => Number(client.debtLeft) > 0
    );
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.addId();
    });
  }

  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.haveNotPaidCopy!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue) ||
            client.amountPaid?.includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.haveNotPaidCopy);
    }
  }
}
