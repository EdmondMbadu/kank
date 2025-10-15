import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MessagingService } from 'src/app/services/messaging.service';

type BulkFailure = { client: Card; error: string };
type BulkResult = {
  total: number;
  succeeded: number;
  failed: number;
  failures: BulkFailure[];
};
type SendResult = { ok: boolean; text: string };

@Component({
  selector: 'app-summary-card-central',
  templateUrl: './summary-card-central.component.html',
  styleUrls: ['./summary-card-central.component.css'],
})
export class SummaryCardCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    public messaging: MessagingService
  ) {}

  // Tri-state filter for finished cards
  doneFilter: 'exclude' | 'only' | 'all' = 'all';

  cycleDoneFilter() {
    this.doneFilter =
      this.doneFilter === 'exclude'
        ? 'only'
        : this.doneFilter === 'only'
        ? 'all'
        : 'exclude';
    this.applyCardsFilters();
  }

  doneFilterLabel(): string {
    switch (this.doneFilter) {
      case 'exclude':
        return 'Exclure « Terminé »';
      case 'only':
        return 'Uniquement « Terminé »';
      default:
        return 'Tous (inclure « Terminé »)';
    }
  }

  allUsers: User[] = [];
  allClientsCard?: Card[];

  // existing summary state
  valuesConvertedToDollars: string[] = [];
  clientsCard: Card[] = [];
  currentClientsCard: Card[] = [];
  elements: number = 10;

  linkPath: string[] = [
    '/client-info-card',
    '/client-info-card',
    '/client-info-card',
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/people.svg',
    '../../../assets/img/debt.png',
  ];
  summary: string[] = [
    'Carte Clients Total Central',
    'Carte Clients Actuel Central',
    'Epargne Carte Central',
  ];
  summaryContent: string[] = [];
  sContent: string[] = [];

  // ================= NEW: CARDS DASHBOARD STATE =================

  // NEW: toggle state (default = exclude finished)
  showOnlyDone = false;

  isCardDone(c: any): boolean {
    // explicit “status” label (your snippet sets 'Terminé' when clientCardStatus is truthy)
    const status = (c?.status ?? '').toString().trim().toLowerCase();
    if (status === 'terminé' || status === 'termine') return true;

    // clientCardStatus may be boolean or string like 'ended' / 'terminé'
    const cs = c?.clientCardStatus;
    if (typeof cs === 'boolean') return cs === true;
    const csStr = (cs ?? '').toString().trim().toLowerCase();
    return (
      csStr === 'ended' ||
      csStr === 'terminé' ||
      csStr === 'termine' ||
      csStr === 'done' ||
      csStr === 'finished' ||
      csStr === 'completed'
    );
  }

  toggleDoneMode() {
    this.showOnlyDone = !this.showOnlyDone;
    this.applyCardsFilters();
  }

  cardsAll: Card[] = [];
  cardsFiltered: Card[] = [];
  cardsSearchControl = new FormControl('');

  minAmountToPay = 0; // ✅ new filter on Card.amountToPay

  cardUniqueLocations: string[] = [];
  cardSelectedLocations = new Set<string>();
  cardsSelectAll = true;

  // single SMS modal
  cardSmsModal = {
    open: false,
    client: null as Card | null,
    message: '' as string,
    phone: '' as string,
    displayName: '' as string,
    location: '' as string,
  };
  cardSending = false;
  cardSendResult: SendResult | null = null;

  // bulk modal
  cardBulkModal = {
    open: false,
    message: '' as string,
    recipients: [] as Card[],
    excludedNoPhone: 0,
    result: null as BulkResult | null,
  };
  cardBulkSending = false;

  // placeholders
  cardPlaceholderTokens = [
    '{{FULL_NAME}}',
    '{{LOCATION_NAME}}',
    '{{MAX_AMOUNT}}',
  ];

  ngOnInit(): void {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      this.getAllClientsCard();
    });
  }

  // ======== FETCH & SUMMARY =========
  getAllClientsCard() {
    let tempClients: Card[] = [];
    this.allClientsCard = [];
    let completedRequests = 0;

    this.allUsers.forEach((user) => {
      this.auth.getClientsCardOfAUser(user.uid!).subscribe((clients) => {
        // tag with locationName, and normalize likely fields used downstream
        const tagged = clients.map((c: any) => ({
          ...c,
          locationName: c.locationName || user.firstName,
        }));
        tempClients = tempClients.concat(tagged);
        completedRequests++;
        if (completedRequests === this.allUsers.length) {
          this.filterAndInitializeClientsCard(tempClients);
        }
      });
    });
  }

  filterAndInitializeClientsCard(allClients: Card[]) {
    const unique = new Map<string, Card>();
    allClients.forEach((client: any) => {
      const key =
        client.uid ||
        client.trackingId ||
        `${client.firstName}-${client.lastName}-${client.phoneNumber}`;
      if (!unique.has(key)) unique.set(key, client);
    });

    this.allClientsCard = Array.from(unique.values());
    this.initalizeInputs(); // existing summary
    this.buildCardsDataset(); // new dashboard dataset
  }

  initalizeInputs() {
    this.currentClientsCard = [];
    const actual = this.findCurrentClientsCard();
    const total = this.allClientsCard?.length ?? 0;
    const clientCardSavings = this.findMoneyToReturnToClients();

    this.summaryContent = [`${total}`, `${actual}`, `${clientCardSavings}`];
    this.valuesConvertedToDollars = [
      '',
      '',
      `${this.compute.convertCongoleseFrancToUsDollars(
        clientCardSavings.toString()
      )}`,
    ];
  }

  findCurrentClientsCard() {
    this.allClientsCard?.forEach((client: any) => {
      if (client.clientCardStatus !== 'ended') {
        this.currentClientsCard!.push(client);
      }
    });
    return this.currentClientsCard?.length;
  }

  findMoneyToReturnToClients() {
    let total = 0;
    this.currentClientsCard.forEach((client: any) => {
      total += Number(client.amountPaid) - Number(client.amountToPay);
    });
    return total;
  }

  // ======== NEW: CARDS DATASET & FILTERS =========
  private buildCardsDataset() {
    // target: active (not ended) cards holders
    // this.cardsAll = (this.allClientsCard ?? []).filter(
    //   (c: any) => c.clientCardStatus !== 'ended'
    // );

    this.cardsAll = this.allClientsCard ?? [];
    // locations
    const set = new Set<string>();
    for (const c of this.cardsAll as any[]) {
      if (c.locationName) set.add(c.locationName);
    }
    this.cardUniqueLocations = Array.from(set).sort((a, b) =>
      a.localeCompare(b)
    );
    this.resetCardLocationSelection(true);

    this.setupCardsSearch();
    this.applyCardsFilters();
  }

  private setupCardsSearch() {
    this.cardsSearchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => {
        this.applyCardsFilters();
      });
  }

  private resetCardLocationSelection(all = true) {
    this.cardSelectedLocations.clear();
    if (all) {
      this.cardUniqueLocations.forEach((l) =>
        this.cardSelectedLocations.add(l)
      );
      this.cardsSelectAll = true;
    } else {
      this.cardsSelectAll = false;
    }
  }

  toggleAllCardLocations() {
    this.cardsSelectAll = !this.cardsSelectAll;
    this.resetCardLocationSelection(this.cardsSelectAll);
    this.applyCardsFilters();
  }

  toggleCardLocation(loc: string) {
    if (this.cardSelectedLocations.has(loc))
      this.cardSelectedLocations.delete(loc);
    else this.cardSelectedLocations.add(loc);
    this.cardsSelectAll =
      this.cardSelectedLocations.size === this.cardUniqueLocations.length;
    this.applyCardsFilters();
  }

  applyCardsFilters() {
    const term = String(this.cardsSearchControl.value || '')
      .trim()
      .toLowerCase();

    // 1) site filter
    let base = (this.cardsAll as any[]).filter((c) =>
      this.cardSelectedLocations.has(c.locationName || '')
    );

    // 2) done tri-state
    if (this.doneFilter === 'exclude') {
      base = base.filter((c) => !this.isCardDone(c));
    } else if (this.doneFilter === 'only') {
      base = base.filter((c) => this.isCardDone(c));
    } // 'all' → leave base as-is

    // 3) amountToPay filter
    const withAmount = base.filter(
      (c) => this.amountToPay(c) >= (Number(this.minAmountToPay) || 0)
    );

    // 4) valid phone
    const withPhone = withAmount.filter(
      (c) =>
        !!(
          c.phoneNumber && ('' + c.phoneNumber).replace(/\D/g, '').length >= 10
        )
    );

    // 5) search
    this.cardsFiltered = term
      ? (withPhone as any[]).filter(
          (c) =>
            `${c.firstName || ''} ${c.middleName || ''} ${c.lastName || ''}`
              .toLowerCase()
              .includes(term) || (c.phoneNumber || '').includes(term)
        )
      : (withPhone as Card[]);
  }

  amountToPay(c: any): number {
    return Number(c?.amountToPay ?? 0);
  }

  // ======== SINGLE SMS (CARDS) =========
  openCardSmsModal(c: Card) {
    const anyC: any = c;
    this.cardSendResult = null;
    this.cardSmsModal.client = c;
    this.cardSmsModal.phone = anyC.phoneNumber || '';
    this.cardSmsModal.displayName =
      `${anyC.firstName || ''} ${anyC.lastName || ''}`.trim() || 'Client';
    this.cardSmsModal.location = anyC.locationName || 'site';
    this.cardSmsModal.message = this.buildDefaultCardTemplate(anyC);
    this.cardSmsModal.open = true;
  }

  closeCardSmsModal() {
    this.cardSmsModal.open = false;
    this.cardSmsModal.client = null;
    this.cardSmsModal.message = '';
    this.cardSending = false;
    this.cardSendResult = null;
  }

  applyDefaultCardTemplate() {
    if (this.cardSmsModal.client)
      this.cardSmsModal.message = this.buildDefaultCardTemplate(
        this.cardSmsModal.client as any
      );
  }

  private buildDefaultCardTemplate(c: any): string {
    const loc = c.locationName || 'site';
    // MAX_AMOUNT is fixed to 400,000 FC for cards clients
    return `Mbote ${c.firstName || ''} ${c.lastName || ''},
To moni ozali kosalela CARTE na FONDATION GERVAIS. 
Soki olingi kobanda kozua crédit ya liboso, tokoki kopesa yo {{MAX_AMOUNT}} FC. 
Kende na FONDATION GERVAIS location {{LOCATION_NAME}}.
Merci pona confiance na FONDATION GERVAIS`;
  }

  async sendSmsToCardClient() {
    const phone = this.cardSmsModal.phone;
    const msg = this.cardSmsModal.message?.trim();
    if (!phone || !msg) return;

    this.cardSending = true;
    this.cardSendResult = null;
    const c: any = this.cardSmsModal.client;

    try {
      const text = this.personalizeCardMessage(msg, c);
      await this.messaging.sendCustomSMS(phone, text, {
        reason: 'invite_card_to_loan',
        clientId: c.trackingId || c.uid || null,
        clientName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        locationName: c.locationName || null,
      });
      this.cardSendResult = { ok: true, text: 'SMS envoyé avec succès.' };
    } catch (e) {
      console.error(e);
      this.cardSendResult = { ok: false, text: 'Échec de l’envoi du SMS.' };
    } finally {
      this.cardSending = false;
    }
  }

  // ======== BULK (CARDS) =========
  openCardBulkModal() {
    this.cardBulkModal.open = true;
    this.cardBulkModal.result = null;
    this.applyDefaultCardBulkTemplate();
    this.updateCardBulkRecipients();
  }

  closeCardBulkModal() {
    this.cardBulkModal.open = false;
    this.cardBulkModal.message = '';
    this.cardBulkModal.recipients = [];
    this.cardBulkModal.result = null;
    this.cardBulkSending = false;
  }

  applyDefaultCardBulkTemplate() {
    this.cardBulkModal.message = `Mbote {{FULL_NAME}},
To moni ozali kosalela CARTE (épargne) na FONDATION GERVAIS. 
Soki olingi kobanda kozua crédit ya liboso, okoki kozua {{MAX_AMOUNT}} FC. 
Kende na FONDATION GERVAIS location {{LOCATION_NAME}}.
Merci pona confiance na FONDATION GERVAIS`;
  }

  updateCardBulkRecipients() {
    const list: Card[] = [];
    let excludedNoPhone = 0;

    for (const c of this.cardsFiltered as any[]) {
      const okPhone = !!(
        c.phoneNumber && ('' + c.phoneNumber).replace(/\D/g, '').length >= 10
      );
      if (!okPhone) {
        excludedNoPhone += 1;
        continue;
      }
      // optional monthly filter already applied in cardsFiltered
      list.push(c);
    }
    this.cardBulkModal.recipients = list;
    this.cardBulkModal.excludedNoPhone = excludedNoPhone;
  }

  async sendCardBulkSms() {
    if (
      !this.cardBulkModal.message?.trim() ||
      this.cardBulkModal.recipients.length === 0
    )
      return;

    this.cardBulkSending = true;
    const failures: BulkFailure[] = [];
    let succeeded = 0;

    for (const c of this.cardBulkModal.recipients as any[]) {
      try {
        const text = this.personalizeCardMessage(this.cardBulkModal.message, c);
        await this.messaging.sendCustomSMS(c.phoneNumber!, text, {
          reason: 'invite_card_to_loan_bulk',
          clientId: c.trackingId || c.uid || null,
          clientName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
          locationName: c.locationName || null,
        });
        succeeded += 1;
      } catch (e: any) {
        console.error('Bulk SMS error', e);
        failures.push({ client: c, error: e?.message || 'Échec d’envoi' });
      }
    }

    const total = this.cardBulkModal.recipients.length;
    this.cardBulkModal.result = {
      total,
      succeeded,
      failed: failures.length,
      failures,
    };
    this.cardBulkSending = false;
  }

  // ======== HELPERS =========
  monthlyContribution(c: any): number {
    // best-effort normalization (handles weekly OR monthly fields if they exist)
    const weekly = Number(
      c.amountPerWeek ?? c.weeklyAmount ?? c.weeklySaving ?? 0
    );
    const monthly = Number(
      c.amountPerMonth ?? c.monthlyAmount ?? c.monthlySaving ?? 0
    );
    if (monthly > 0) return monthly;
    if (weekly > 0) return weekly * 4; // approx. 4 weeks
    return 0;
    // If later you provide the exact field, just replace the logic above.
  }

  formatDisplayPhone(raw?: string | null) {
    if (!raw) return '';
    const digits = ('' + raw).replace(/\D/g, '');
    if (digits.length === 10)
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return raw;
  }

  toFcDisplay(n: number | string) {
    return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  }

  estimatedSegments(text: string = '') {
    const len = text.length;
    const segSize = 160;
    return Math.max(1, Math.ceil(len / segSize));
  }

  previewCardPersonalized() {
    const first = this.cardBulkModal.recipients?.[0];
    return first
      ? this.personalizeCardMessage(this.cardBulkModal.message, first as any)
      : '—';
  }

  private personalizeCardMessage(msg: string, c: any): string {
    const fullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
    let out = msg
      .replace(/\{\{\s*FULL_NAME\s*\}\}/g, fullName)
      .replace(/\{\{\s*LOCATION_NAME\s*\}\}/g, c.locationName ?? 'site')
      // fixed default 400,000 FC for cards clients:
      .replace(/\{\{\s*MAX_AMOUNT\s*\}\}/g, this.toFcDisplay(400000));

    return out;
  }

  get cardSelectedLocationsArray(): string[] {
    return Array.from(this.cardSelectedLocations);
  }

  trackByLoc(index: number, loc: string) {
    return loc;
  }
}
