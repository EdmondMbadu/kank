import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { MessagingService } from 'src/app/services/messaging.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
type SendResult = { ok: boolean; text: string };
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
  smsModal = {
    open: false,
    client: null as Client | null,
    message: '' as string,
  };
  sending = false;
  sendResult: SendResult | null = null;
  constructor(
    private router: Router,
    public auth: AuthService,
    public messaging: MessagingService,
    public computation: ComputationService
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

  /** Build the badge style for a given client */
  creditBadgeStyle(score: string | number | null | undefined) {
    const val = Number(score) || 0; // cast to number, default 0
    return {
      'background-color': this.computation.getGradientColor(val),
      color: val < 80 ? '#fff' : '#000', // white text for darker hues
    };
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

  //  ======= Modal helpers =======
  openSmsModal(c: Client) {
    this.sendResult = null;
    this.smsModal.client = c;
    this.smsModal.message = this.buildDefaultTemplate(c); // prefill (can be edited)
    this.smsModal.open = true;
  }

  closeSmsModal() {
    this.smsModal.open = false;
    this.smsModal.client = null;
    this.smsModal.message = '';
    this.sending = false;
    this.sendResult = null;
  }

  applyDefaultTemplate() {
    if (this.smsModal.client) {
      this.smsModal.message = this.buildDefaultTemplate(this.smsModal.client);
    }
  }

  buildDefaultTemplate(c: Client): string {
    // Placeholder until you give me your generic message:
    // Edit freely in the modal; variables are injected here.
    return `Mbote ${c.firstName} ${c.lastName},
To sepili mingi na efuteli ya credit na yo na Fondation Gervais. 
Soki olingi lisusu kozua credit pona mombongo na yo, kende na Fondation Gervais location ${this.auth.currentUser.firstName}.
Merci pona confiance na Fondation Gervais`;
  }

  async sendSmsToClient() {
    if (!this.smsModal.client?.phoneNumber || !this.smsModal.message.trim())
      return;
    this.sending = true;
    this.sendResult = null;

    try {
      await this.messaging.sendCustomSMS(
        this.smsModal.client.phoneNumber,
        this.smsModal.message,
        {
          reason: 'invite_back_for_funding',
          clientId: this.smsModal.client.trackingId || null,
          clientName:
            `${this.smsModal.client.firstName} ${this.smsModal.client.lastName}`.trim(),
        }
      );
      this.sendResult = { ok: true, text: 'SMS envoyé avec succès.' };
    } catch (e) {
      console.error(e);
      this.sendResult = { ok: false, text: 'Échec de l’envoi du SMS.' };
    } finally {
      this.sending = false;
    }
  }

  // Display helpers
  formatDisplayPhone(raw?: string | null) {
    if (!raw) return '';
    const digits = ('' + raw).replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return raw;
  }

  estimatedSegments(text: string = '') {
    // crude estimate for GSM-7 (160) / UCS-2 (70) not handled; keep simple
    const len = text.length;
    const segSize = 160;
    return Math.max(1, Math.ceil(len / segSize));
  }
}
