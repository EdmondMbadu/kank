import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-finished-debt',
  templateUrl: './finished-debt.component.html',
  styleUrls: ['./finished-debt.component.css'],
})
export class FinishedDebtComponent implements OnInit {
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
      this.findClientsWhoFinishedDebts();
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
    // Sécurise la phase où les données ne sont pas encore chargées.
    if (!this.clients) {
      return of(this.currentClients ?? []);
    }

    const term = (value ?? '').trim().toLowerCase();
    if (!term) {
      return of(this.currentClients ?? this.clients);
    }

    return of(
      (this.currentClients ?? this.clients).filter((c) =>
        `${c.firstName} ${c.middleName} ${c.lastName}`
          .toLowerCase()
          .includes(term)
      )
    );
  }

  findClientsWhoFinishedDebts() {
    this.currentClients = [];
    this.clients?.forEach((client) => {
      if (Number(client.debtLeft) === 0 && client.type !== 'register') {
        this.currentClients!.push(client);
      }
    });
  }
}
