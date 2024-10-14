import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-client-info-savings',
  templateUrl: './client-info-savings.component.html',
  styleUrls: ['./client-info-savings.component.css'],
})
export class ClientInfoSavingsComponent implements OnInit {
  clients?: Client[];
  currentClients?: Client[] = [];
  filteredItems?: Client[];
  searchControl = new FormControl();
  constructor(private router: Router, public auth: AuthService) {
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
      this.currentClients = [];
      this.findClientsWithoutDebtsButWithSavings();
      this.filteredItems = this.currentClients;
      this.addIdToFilterItems();
    });
  }

  addIdToFilterItems() {
    let total = 0;
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
      total += Number(this.clients![i].debtLeft);
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
  findClientsWithoutDebtsButWithSavings() {
    this.currentClients = [];
    this.clients?.forEach((client) => {
      if (
        Number(client.debtLeft) === 0 &&
        Number(client.savings) > 0 &&
        client.type !== 'register'
      ) {
        this.currentClients!.push(client);
      }
    });
  }
}
