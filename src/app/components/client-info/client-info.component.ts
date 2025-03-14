import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { map } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-client-info',
  templateUrl: './client-info.component.html',
  styleUrls: ['./client-info.component.css'],
})
export class ClientInfoComponent implements OnInit {
  clients?: Client[];
  filteredItems?: Client[];
  searchControl = new FormControl();
  constructor(
    private router: Router,
    public auth: AuthService,
    public data: DataService
  ) {
    this.retrieveClients();
  }
  debts: string[] = [];
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
      this.filteredItems = data;
      this.addIdToFilterItems();
    });
  }

  addIdToFilterItems() {
    let total = 0;
    for (let i = 0; i < this.filteredItems!.length; i++) {
      this.filteredItems![i].trackingId = `${i}`;
      if (
        this.filteredItems![i].debtLeft !== undefined &&
        this.filteredItems![i].debtLeft !== NaN.toString()
      ) {
        total += Number(this.filteredItems![i].debtLeft);
      }

      // this is to spot clients that goes to Nan for one reason or another
      if (this.filteredItems![i].debtLeft === NaN.toString()) {
        // console.log('the client with NaN is ', this.filteredItems![i]);
      }
    }
  }
  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.clients!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue) ||
            client.amountPaid?.includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.clients);
    }
  }

  batchCreditScoreUpdate() {
    this.data.updateClientCreditScoreBulk(this.clients!);
  }
}
