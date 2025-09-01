import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { MessagingService } from 'src/app/services/messaging.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
type SendResult = { ok: boolean; text: string };

type BulkFailure = { client: Client; error: string };
type BulkResult = {
  total: number;
  succeeded: number;
  failed: number;
  failures: BulkFailure[];
};
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

  bulkModal = {
    open: false,
    minScore: 60, // default threshold
    message: '' as string, // shared message for everyone
    recipients: [] as Client[], // computed list
    excludedNoPhone: 0, // count of no-phone excluded
    result: null as BulkResult | null,
  };
  placeholderTokens = ['{{FULL_NAME}}', '{{firstName}}', '{{lastName}}'];

  bulkSending = false;
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

  openBulkModal() {
    this.bulkModal.open = true;
    this.bulkModal.result = null;
    this.bulkModal.minScore = 60;
    this.applyDefaultBulkTemplate();
    this.updateBulkRecipients();
  }

  closeBulkModal() {
    this.bulkModal.open = false;
    this.bulkModal.message = '';
    this.bulkModal.recipients = [];
    this.bulkModal.result = null;
    this.bulkSending = false;
  }
  applyDefaultBulkTemplate() {
    this.bulkModal.message = `Mbote {{FULL_NAME}},
To sepili mingi na efuteli ya credit na yo na Fondation Gervais. 
Soki olingi lisusu kozua credit pona mombongo na yo, kende na Fondation Gervais location ${this.auth.currentUser.firstName}.
Merci pona confiance na Fondation Gervais`;
  }

  updateBulkRecipients() {
    // Base: vos "currentClients" sont déjà ceux qui ont tout remboursé (debtLeft == 0)
    const base = this.currentClients ?? [];
    const min = Number(this.bulkModal.minScore) || 0;

    const withPhones: Client[] = [];
    let excludedNoPhone = 0;

    for (const c of base) {
      const score = Number(c.creditScore ?? 0);
      const hasPhone = !!(
        c.phoneNumber && ('' + c.phoneNumber).replace(/\D/g, '').length >= 10
      );
      if (!hasPhone) {
        excludedNoPhone += 1;
        continue;
      }
      if (score >= min) {
        withPhones.push(c);
      }
    }

    this.bulkModal.recipients = withPhones;
    this.bulkModal.excludedNoPhone = excludedNoPhone;
  }

  async sendBulkSms() {
    if (
      !this.bulkModal.message?.trim() ||
      this.bulkModal.recipients.length === 0
    )
      return;

    this.bulkSending = true;
    const failures: BulkFailure[] = [];
    let succeeded = 0;

    for (const c of this.bulkModal.recipients) {
      try {
        const text = this.personalizeMessage(this.bulkModal.message, c); // 👈 personalize here
        await this.messaging.sendCustomSMS(c.phoneNumber!, text, {
          reason: 'invite_back_for_funding_bulk',
          clientId: c.trackingId || null,
          clientName: `${c.firstName} ${c.lastName}`.trim(),
          minCreditScore: this.bulkModal.minScore,
        });
        succeeded += 1;
      } catch (e: any) {
        console.error('Bulk SMS error', e);
        failures.push({ client: c, error: e?.message || 'Échec d’envoi' });
      }
    }

    const total = this.bulkModal.recipients.length;
    this.bulkModal.result = {
      total,
      succeeded,
      failed: failures.length,
      failures,
    };
    this.bulkSending = false;
  }

  private personalizeMessage(msg: string, c: Client): string {
    const fullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
    return msg
      .replace(/\{\{\s*FULL_NAME\s*\}\}/g, fullName)
      .replace(/\{\{\s*firstName\s*\}\}/g, c.firstName ?? '')
      .replace(/\{\{\s*lastName\s*\}\}/g, c.lastName ?? '');
  }
  previewPersonalized() {
    const first = this.bulkModal.recipients?.[0];
    return first ? this.personalizeMessage(this.bulkModal.message, first) : '—';
  }
}
