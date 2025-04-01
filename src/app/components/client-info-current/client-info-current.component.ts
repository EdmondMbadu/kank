import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-client-info-current',
  templateUrl: './client-info-current.component.html',
  styleUrls: ['./client-info-current.component.css'],
})
export class ClientInfoCurrentComponent implements OnInit {
  clients?: Client[];
  currentClients?: Client[] = [];
  filteredItems?: Client[];
  searchControl = new FormControl();
  constructor(
    private router: Router,
    public auth: AuthService,
    private data: DataService
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
      this.currentClients = [];
      this.findClientsWithDebts();
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
        this.clients!.filter((client) => {
          try {
            return (
              client.firstName?.toLowerCase().includes(lowerCaseValue) ||
              client.lastName?.toLowerCase().includes(lowerCaseValue) ||
              client.middleName?.toLowerCase().includes(lowerCaseValue) ||
              client.phoneNumber?.toLowerCase().includes(lowerCaseValue) ||
              client.amountPaid?.toString().includes(lowerCaseValue) // Safely convert
            );
          } catch (err) {
            console.error(
              'Error with client:',
              client,
              'amountPaid:',
              client.amountPaid,
              err
            );
            return false;
          }
        })
      );
    } else {
      return of(this.clients);
    }
  }

  findClientsWithDebts() {
    this.currentClients = [];
    this.currentClients = this.data.findClientsWithDebts(this.clients!);
  }

  // client-info-current.component.ts
  onBatchQuit() {
    if (!this.currentClients?.length) return;

    // Just call the data service's batch method
    this.data
      .batchUpdateVitalStatus(this.currentClients, 'Quitté')
      .then(() => {
        alert('All clients updated to "Quitté" in a single batch!');
        console.log('All clients updated to "Quitté" in a single batch!');
        // Optionally refresh the UI or show a success message
        // this.retrieveClients();
      })
      .catch((err) => console.error('Batch update error: ', err));
  }
}
