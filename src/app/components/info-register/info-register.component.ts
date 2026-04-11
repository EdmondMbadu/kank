import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';

type ClientVerificationState = 'verified' | 'unverified' | 'rejected';
type RegisterClientListItem = Client & {
  verificationState: ClientVerificationState;
  verificationLabel: string;
};

@Component({
  selector: 'app-info-register',
  templateUrl: './info-register.component.html',
  styleUrls: ['./info-register.component.css'],
})
export class InfoRegisterComponent implements OnInit {
  clients: RegisterClientListItem[] = [];
  currentRegisterClients: RegisterClientListItem[] = [];
  filteredItems: RegisterClientListItem[] = [];
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
    this.auth.getAllClients().subscribe((data: Client[] | Client | null | undefined) => {
      const clients = Array.isArray(data) ? data : data ? [data] : [];

      this.clients = clients.map((client, index) =>
        this.buildRegisterClientListItem(client, index)
      );
      this.findClientsRegistered();
      this.filteredItems = [...this.currentRegisterClients];
    });
  }

  private buildRegisterClientListItem(
    client: Client,
    index: number
  ): RegisterClientListItem {
    const verificationState = this.getVerificationState(client);

    return {
      ...client,
      trackingId: `${index}`,
      verificationState,
      verificationLabel: this.getVerificationLabel(verificationState),
    };
  }

  private getVerificationState(client: Client): ClientVerificationState {
    if (client.requestType === 'rejection') {
      return 'rejected';
    }

    return this.isClientVerified(client) ? 'verified' : 'unverified';
  }

  private getVerificationLabel(state: ClientVerificationState): string {
    switch (state) {
      case 'verified':
        return 'Vérifié';
      case 'rejected':
        return 'Rejet en cours';
      default:
        return 'Non vérifié';
    }
  }

  isClientVerified(client: Client): boolean {
    return String(client.agentSubmittedVerification).trim().toLowerCase() === 'true';
  }

  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.currentRegisterClients.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue) ||
            client.amountPaid?.includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.currentRegisterClients);
    }
  }
  findClientsRegistered() {
    this.currentRegisterClients = [];
    this.clients.forEach((client) => {
      if (client.type !== undefined && client.type === 'register') {
        this.currentRegisterClients.push(client);
      }
    });
  }
}
