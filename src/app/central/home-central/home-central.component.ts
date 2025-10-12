import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Client } from 'src/app/models/client';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { DataService } from 'src/app/services/data.service';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { FormControl } from '@angular/forms';
import { MessagingService } from 'src/app/services/messaging.service';

type BulkFailure = { client: Client; error: string };
type BulkResult = {
  total: number;
  succeeded: number;
  failed: number;
  failures: BulkFailure[];
};
type SendResult = { ok: boolean; text: string };

@Component({
  selector: 'app-home-central',
  templateUrl: './home-central.component.html',
  styleUrls: ['./home-central.component.css'],
})
export class HomeCentralComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    public compute: ComputationService,
    private data: DataService,
    private fns: AngularFireFunctions,
    public messaging: MessagingService
  ) {}

  isFetchingClients = false;
  currentClients: Array<Client[]> = [];
  allcurrentClientsWithDebts: Client[] = [];
  allCurrentClientsWithDebtsScheduledToPayToday: Client[] = [];
  allUsers: User[] = [];

  // master list search
  searchControl = new FormControl('');
  filteredItems: Client[] = [];

  theDay: string = new Date().toLocaleString('en-US', { weekday: 'long' });

  allClients?: Client[];
  allCurrentClients?: Client[] = [];
  allClientsWithoutDebtsButWithSavings?: Client[] = [];
  savingsWithoutDebtsButWithSavings: number = 0;
  valuesConvertedToDollars: string[] = [];

  // ===== NEW: multi-site finished-debt dashboard state =====
  finishedAll: Client[] = []; // all finished across all sites
  finishedFiltered: Client[] = []; // after filters
  fdSearchControl = new FormControl('');
  fdMinScore = 60;

  uniqueLocations: string[] = [];
  selectedLocations = new Set<string>();
  selectAllLocations = true;

  // single SMS modal
  smsModal = {
    open: false,
    client: null as Client | null,
    message: '' as string,
  };
  sending = false;
  sendResult: SendResult | null = null;

  // bulk modal
  bulkModal = {
    open: false,
    minScore: 60,
    message: '' as string,
    recipients: [] as Client[],
    excludedNoPhone: 0,
    result: null as BulkResult | null,
  };
  bulkSending = false;

  placeholderTokens = [
    '{{FULL_NAME}}',
    '{{firstName}}',
    '{{lastName}}',
    '{{LOCATION_NAME}}',
    '{{MAX_AMOUNT}}',
  ];

  ngOnInit(): void {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      if (this.allUsers.length > 1) this.getAllClients();
    });
  }

  getAllClients() {
    if (this.isFetchingClients) return;
    this.isFetchingClients = true;

    let tempClients: Client[] = [];
    this.allClients = [];
    let completedRequests = 0;

    this.allUsers.forEach((user) => {
      this.auth.getClientsOfAUser(user.uid!).subscribe((clients) => {
        const tagged = clients.map((c) => ({
          ...c,
          locationName: user.firstName,
        }));
        tempClients = tempClients.concat(tagged);
        completedRequests++;
        if (completedRequests === this.allUsers.length) {
          this.filterAndInitializeClients(tempClients);
          this.isFetchingClients = false;
        }
      });
    });
  }

  filterAndInitializeClients(allClients: Client[]) {
    const unique = new Map<string, Client>();
    allClients.forEach((client) => {
      const key =
        client.uid ||
        client.trackingId ||
        `${client.firstName}-${client.lastName}-${client.phoneNumber}`;
      if (!unique.has(key)) unique.set(key, client);
    });
    this.allClients = Array.from(unique.values());

    this.initalizeInputs();
    this.filteredItems = this.allClients ?? [];
    this.setupSearch();

    // build finished-debt dataset + filters
    this.buildFinishedAll();
    this.buildUniqueLocations();
    this.resetLocationSelection(true);
    this.setupFdSearch();
    this.applyFinishedFilters();
  }

  // ===== existing summary logic =====
  linkPath: string[] = [
    '/client-info',
    '/client-info-current',
    '/add-investment',
    '/client-info-current',
    '/client-info-current',
    '/client-info-current',
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/people.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/debt.png',
    '../../../assets/img/total-income.png',
    '../../../assets/img/saving.svg',
  ];
  summary: string[] = [
    'Nombres des Clients Total',
    'Nombres des Clients Actuel',
    'Clients Avec Epargnes Sans Credit',
    'Argent Investi',
    'Prêt Restant',
    "Chiffre D'Affaire",
    'Montant Epargnes Sans Credit',
  ];
  summaryContent: string[] = [];
  sContent: string[] = [];

  initalizeInputs() {
    this.findClientsWithoutDebtsButWithSavings();
    this.findAllClientsWithDebts();

    const reserve = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'reserveAmount')
      .toString();
    const moneyHand = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'moneyInHands')
      .toString();
    const invested = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'amountInvested')
      .toString();
    const debtTotal = this.data.findTotalDebtLeft(this.allClients!);
    const cardM = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'cardsMoney')
      .toString();

    const totalIncome = (
      Number(reserve) +
      Number(moneyHand) +
      Number(debtTotal) +
      Number(cardM)
    ).toString();

    this.summaryContent = [
      `${this.findNumberOfAllClients()}`,
      `${this.findClientsWithDebts()}`,
      `${this.findClientsWithoutDebtsButWithSavings()}`,
      `${invested}`,
      `${debtTotal}`,
      `${totalIncome}`,
      `${this.savingsWithoutDebtsButWithSavings.toString()}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      ``,
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(invested)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(debtTotal)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(totalIncome)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.savingsWithoutDebtsButWithSavings!.toString()
      )}`,
    ];
  }

  findNumberOfAllClients() {
    let total = 0;
    this.allUsers.forEach((user) => (total += Number(user.numberOfClients)));
    return total;
  }

  findClientsWithDebts() {
    this.allCurrentClients = this.data.findClientsWithDebts(this.allClients!);
    return this.allCurrentClients?.length;
  }

  findAllClientsWithDebts() {
    this.allcurrentClientsWithDebts =
      this.data.findClientsWithDebtsIncludingThoseWhoLeft(this.allClients!);
    this.allCurrentClientsWithDebtsScheduledToPayToday =
      this.allcurrentClientsWithDebts.filter((d) => {
        return (
          d.paymentDay === this.theDay &&
          d &&
          this.data.didClientStartThisWeek(d) &&
          d.isPhoneCorrect !== 'false'
        );
      });
    return this.allcurrentClientsWithDebts?.length
      ? this.allcurrentClientsWithDebts
      : [];
  }

  findClientsWithoutDebtsButWithSavings() {
    this.savingsWithoutDebtsButWithSavings = 0;
    let total = 0;
    this.allClientsWithoutDebtsButWithSavings = [];
    this.allClients?.forEach((client) => {
      if (Number(client.debtLeft) <= 0 && Number(client.savings) > 0) {
        total += Number(client.savings);
        this.allClientsWithoutDebtsButWithSavings!.push(client);
      }
    });
    this.savingsWithoutDebtsButWithSavings = total;
    return this.allClientsWithoutDebtsButWithSavings?.length;
  }

  // ===== master search =====
  private setupSearch() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((term) => {
        if (!term) {
          this.filteredItems = this.allClients ?? [];
          return;
        }
        const v = String(term).toLowerCase();
        this.filteredItems = (this.allClients ?? []).filter(
          (cl) =>
            cl.firstName?.toLowerCase().includes(v) ||
            cl.lastName?.toLowerCase().includes(v) ||
            cl.middleName?.toLowerCase().includes(v) ||
            cl.phoneNumber?.includes(v) ||
            cl.locationName?.toLowerCase().includes(v)
        );
      });
  }

  // ===== scheduled-to-pay reminders (existing) =====
  sendReminders() {
    if (
      !this.allCurrentClientsWithDebtsScheduledToPayToday ||
      this.allCurrentClientsWithDebtsScheduledToPayToday.length === 0
    ) {
      console.log('No clients to remind.');
      return;
    }

    const clientsPayload =
      this.allCurrentClientsWithDebtsScheduledToPayToday.map((client) => {
        const minPayment = this.data.minimumPayment(client);
        return {
          firstName: client.firstName,
          lastName: client.lastName,
          phoneNumber: client.phoneNumber,
          minPayment,
          debtLeft: client.debtLeft,
          savings: client.savings,
        };
      });

    const callable = this.fns.httpsCallable('sendPaymentReminders');
    callable({ clients: clientsPayload }).subscribe({
      next: (result: any) => {
        console.log('Reminder function result:', result);
        alert('Reminders sent successfully!');
      },
      error: (err: any) => {
        console.error('Error calling reminder function', err);
        alert('Error sending reminders. Please try again.');
      },
    });
  }

  // ======================================================================
  // NEW: Finished-debt across all locations — filters & messaging
  // ======================================================================

  private buildFinishedAll() {
    this.finishedAll = (this.allClients ?? []).filter(
      (c) => Number(c.debtLeft) === 0 && (c as any).type !== 'register'
    );
  }

  private buildUniqueLocations() {
    const set = new Set<string>();
    for (const c of this.allClients ?? []) {
      if (c.locationName) set.add(c.locationName);
    }
    this.uniqueLocations = Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  private resetLocationSelection(all = true) {
    this.selectedLocations.clear();
    if (all) {
      this.uniqueLocations.forEach((l) => this.selectedLocations.add(l));
      this.selectAllLocations = true;
    } else {
      this.selectAllLocations = false;
    }
  }

  toggleAllLocations() {
    this.selectAllLocations = !this.selectAllLocations;
    this.resetLocationSelection(this.selectAllLocations);
    this.applyFinishedFilters();
  }

  toggleLocation(loc: string) {
    if (this.selectedLocations.has(loc)) this.selectedLocations.delete(loc);
    else this.selectedLocations.add(loc);
    this.selectAllLocations =
      this.selectedLocations.size === this.uniqueLocations.length;
    this.applyFinishedFilters();
  }

  private setupFdSearch() {
    this.fdSearchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => {
        this.applyFinishedFilters();
      });
  }

  applyFinishedFilters() {
    const v = String(this.fdSearchControl.value || '')
      .trim()
      .toLowerCase();
    const min = Number(this.fdMinScore) || 0;

    const base = this.finishedAll.filter((c) =>
      this.selectedLocations.has(c.locationName || '')
    );
    const withScore = base.filter((c) => Number(c.creditScore ?? 0) >= min);
    const withPhone = withScore.filter(
      (c) =>
        !!(
          c.phoneNumber && ('' + c.phoneNumber).replace(/\D/g, '').length >= 10
        )
    );

    this.finishedFiltered = v
      ? withPhone.filter(
          (c) =>
            `${c.firstName} ${c.middleName} ${c.lastName}`
              .toLowerCase()
              .includes(v) || (c.phoneNumber || '').includes(v)
        )
      : withPhone;
  }

  // ====== single SMS modal ======
  openSmsModal(c: Client) {
    this.sendResult = null;
    this.smsModal.client = c;
    this.smsModal.message = this.buildDefaultTemplate(c);
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
    if (this.smsModal.client)
      this.smsModal.message = this.buildDefaultTemplate(this.smsModal.client);
  }

  private buildDefaultTemplate(c: Client): string {
    const max = this.maxAmountFor(c);
    const maxLine =
      max != null ? `\nOkoki kozua ${this.formatFc(max)} FC.` : '';
    const loc = c.locationName || 'site';
    return `Mbote ${c.firstName} ${c.lastName},
To sepili mingi na efuteli ya credit na yo na FONDATION GERVAIS. 
Soki olingi lisusu kozua credit pona mombongo na yo, kende na FONDATION GERVAIS location ${loc}.${maxLine}
Merci pona confiance na FONDATION GERVAIS`;
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
          clientId:
            this.smsModal.client.trackingId || this.smsModal.client.uid || null,
          clientName:
            `${this.smsModal.client.firstName} ${this.smsModal.client.lastName}`.trim(),
          locationName: this.smsModal.client.locationName || null,
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

  // ====== bulk modal & actions ======
  openBulkModal() {
    this.bulkModal.open = true;
    this.bulkModal.result = null;
    this.bulkModal.minScore = this.fdMinScore;
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
To sepili mingi na efuteli ya credit na yo na FONDATION GERVAIS. 
Soki olingi lisusu kozua credit pona mombongo na yo, kende na FONDATION GERVAIS location {{LOCATION_NAME}}.
Okoki kozua {{MAX_AMOUNT}} FC.
Merci pona confiance na FONDATION GERVAIS`;
  }

  updateBulkRecipients() {
    const min = Number(this.bulkModal.minScore) || 0;
    const base = this.finishedFiltered; // already filtered by site, search, phone
    const list: Client[] = [];
    let excludedNoPhone = 0;

    for (const c of base) {
      const score = Number(c.creditScore ?? 0);
      const okPhone = !!(
        c.phoneNumber && ('' + c.phoneNumber).replace(/\D/g, '').length >= 10
      );
      if (!okPhone) {
        excludedNoPhone += 1;
        continue;
      }
      if (score >= min) list.push(c);
    }
    this.bulkModal.recipients = list;
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
        const text = this.personalizeMessage(this.bulkModal.message, c);
        await this.messaging.sendCustomSMS(c.phoneNumber!, text, {
          reason: 'invite_back_for_funding_bulk',
          clientId: c.trackingId || c.uid || null,
          clientName: `${c.firstName} ${c.lastName}`.trim(),
          minCreditScore: this.bulkModal.minScore,
          locationName: c.locationName || null,
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

  // ===== helpers =====
  creditBadgeStyle(score: string | number | null | undefined) {
    const val = Number(score) || 0;
    return {
      'background-color': this.compute.getGradientColor(val),
      color: val < 80 ? '#fff' : '#000',
    };
  }
  formatDisplayPhone(raw?: string | null) {
    if (!raw) return '';
    const digits = ('' + raw).replace(/\D/g, '');
    if (digits.length === 10)
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return raw;
  }
  estimatedSegments(text: string = '') {
    const len = text.length;
    const segSize = 160;
    return Math.max(1, Math.ceil(len / segSize));
  }
  previewPersonalized() {
    const first = this.bulkModal.recipients?.[0];
    return first ? this.personalizeMessage(this.bulkModal.message, first) : '—';
  }
  private formatFc(n: number | string): string {
    return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  }
  private maxAmountFor(c: Client): number | null {
    const score = Number(c.creditScore);
    if (!Number.isFinite(score)) return null;
    try {
      return this.compute.getMaxLendAmount(score);
    } catch {
      return null;
    }
  }
  private personalizeMessage(msg: string, c: Client): string {
    const fullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
    let out = msg
      .replace(/\{\{\s*FULL_NAME\s*\}\}/g, fullName)
      .replace(/\{\{\s*firstName\s*\}\}/g, c.firstName ?? '')
      .replace(/\{\{\s*lastName\s*\}\}/g, c.lastName ?? '')
      .replace(/\{\{\s*LOCATION_NAME\s*\}\}/g, c.locationName ?? 'site');

    if (/\{\{\s*MAX_AMOUNT\s*\}\}/.test(out)) {
      const max = this.maxAmountFor(c);
      if (max != null) {
        out = out.replace(/\{\{\s*MAX_AMOUNT\s*\}\}/g, this.formatFc(max));
      } else {
        out = out.replace(
          /[ \t]*\r?\n?Okoki kozua\s+\{\{\s*MAX_AMOUNT\s*\}\}\s+FC\.?\s*/i,
          ''
        );
        out = out.replace(/\{\{\s*MAX_AMOUNT\s*\}\}/g, '');
      }
    }
    return out;
  }
  // Add inside the HomeCentralComponent class
  get selectedLocationsArray(): string[] {
    return Array.from(this.selectedLocations); // or [...this.selectedLocations]
  }

  trackByLoc(index: number, loc: string) {
    return loc;
  }
}
