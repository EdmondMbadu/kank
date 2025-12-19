import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';

type FilterMode = 'all' | 'current' | 'finished';
@Component({
  selector: 'app-client-info-card',
  templateUrl: './client-info-card.component.html',
  styleUrls: ['./client-info-card.component.css'],
})
export class ClientInfoCardComponent implements OnInit {
  cards?: Card[];
  currentClients?: Client[] = [];
  filteredItems?: Client[];
  searchControl = new FormControl();
  private filterMode: FilterMode = 'all';
  constructor(
    private router: Router,
    public auth: AuthService,
    private route: ActivatedRoute
  ) {}
  debts: string[] = [];
  ngOnInit(): void {
    /* ── 1. Read the flag put in the route definition ── */
    this.filterMode =
      (this.route.snapshot.data['filter'] as FilterMode) || 'all';
    // Retrieve clients after reading route data so filter is applied correctly
    this.retrieveClientsCard();
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
      this.applyCycleFilter();
    });
  }

  addIdToFilterItems() {
    let total = 0;
    for (let i = 0; i < this.cards!.length; i++) {
      this.cards![i].trackingId = `${i}`;
      // total += Number(this.cards![i].debtLeft);
    }
  }
  search(value: string) {
    // Get the cycle-filtered base first
    let baseItems: Card[];
    switch (this.filterMode) {
      case 'current':
        baseItems = this.cards!.filter((c) => !c.clientCardStatus!);
        break;
      case 'finished':
        baseItems = this.cards!.filter((c) => !!c.clientCardStatus);
        break;
      default:
        baseItems = [...this.cards!];
    }

    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        baseItems.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue) ||
            client.amountPaid?.includes(lowerCaseValue)
        )
      );
    } else {
      return of(baseItems);
    }
  }
  /* ---------- cycle filter ------------ */
  private applyCycleFilter(): void {
    switch (this.filterMode) {
      case 'current':
        this.filteredItems = this.cards!.filter(
          (c) => !c.clientCardStatus! // NOT finished
        );
        break;
      case 'finished':
        this.filteredItems = this.cards!.filter(
          (c) => !!c.clientCardStatus // finished
        );
        break;
      default:
        this.filteredItems = [...this.cards!]; // all
    }
  }
}
