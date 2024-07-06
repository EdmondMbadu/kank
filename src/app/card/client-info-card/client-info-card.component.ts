import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-client-info-card',
  templateUrl: './client-info-card.component.html',
  styleUrls: ['./client-info-card.component.css'],
})
export class ClientInfoCardComponent implements OnInit {
  cards?: Client[];
  currentClients?: Client[] = [];
  filteredItems?: Client[];
  searchControl = new FormControl();
  constructor(private router: Router, public auth: AuthService) {
    this.retrieveClientsCard();
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

  retrieveClientsCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.cards = data;
      this.filteredItems = data;
      this.addIdToFilterItems();
    });
  }

  addIdToFilterItems() {
    let total = 0;
    for (let i = 0; i < this.cards!.length; i++) {
      this.cards![i].trackingId = `${i}`;
      total += Number(this.cards![i].debtLeft);
    }
  }
  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.cards!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue) ||
            client.amountPaid?.includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.cards);
    }
  }
}
