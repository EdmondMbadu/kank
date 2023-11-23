import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-not-paid',
  templateUrl: './not-paid.component.html',
  styleUrls: ['./not-paid.component.css'],
})
export class NotPaidComponent implements OnInit {
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
      this.numberofPeopleWhodidNotPay = this.haveNotPaid.length;
      console.log('have not paid', this.haveNotPaid);
    } else {
      alert('Les dates ne sont pas valides. Entrez des date valides.');
    }
  }
  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.addId();
    });
  }
  addId() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
    }
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
