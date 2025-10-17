import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
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
  private cardsSearchTerm = '';

  minAmountToPay = 0; // ✅ new filter on Card.amountToPay

  cardUniqueLocations: string[] = [];
  cardSelectedLocations = new Set<string>();
  cardsSelectAll = true;
  excludeDuplicatePhones = false;
  cardsPotentialDuplicateCount = 0;
  cardsDuplicateCount = 0;
  excludeCreditOverlap = false;
  cardsCreditOverlapCount = 0;
  cardsCreditOverlapRemoved = 0;
  showOnlyDuplicateTypes: Array<'card' | 'credit'> = [];
  cardDuplicateEntries: Card[] = [];
  creditOverlapEntries: Card[] = [];

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

  allCreditClients: Client[] = [];
  private creditClientPhones = new Set<string>();

  ngOnInit(): void {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      this.getAllClientsCard();
      this.getAllCreditClients();
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

  getAllCreditClients() {
    if (!this.allUsers.length) return;
    let tempClients: Client[] = [];
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
          this.initializeCreditClients(tempClients);
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

  private initializeCreditClients(allClients: Client[]) {
    const unique = new Map<string, Client>();
    allClients.forEach((client) => {
      const key =
        client.uid ||
        client.trackingId ||
        `${client.firstName}-${client.lastName}-${client.phoneNumber}`;
      if (!unique.has(key)) unique.set(key, client);
    });
    this.allCreditClients = Array.from(unique.values());
    this.buildCreditClientPhones();
    this.applyCardsFilters();
  }

  private buildCreditClientPhones() {
    this.creditClientPhones.clear();
    for (const client of this.allCreditClients as any[]) {
      const digits = this.normalizePhoneDigits(client?.phoneNumber);
      if (digits) this.creditClientPhones.add(digits);
    }
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
    this.cardsSearchTerm = String(this.cardsSearchControl.value || '');
    this.applyCardsFilters();
  }

  private setupCardsSearch() {
    this.cardsSearchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((value) => {
        this.cardsSearchTerm = value ? String(value) : '';
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

  toggleDuplicatePhoneFilter() {
    this.excludeDuplicatePhones = !this.excludeDuplicatePhones;
    this.applyCardsFilters();
  }

  toggleCreditOverlapFilter() {
    this.excludeCreditOverlap = !this.excludeCreditOverlap;
    this.applyCardsFilters();
  }

  toggleDuplicateView(type: 'card' | 'credit') {
    if (this.showOnlyDuplicateTypes.includes(type)) {
      this.showOnlyDuplicateTypes = this.showOnlyDuplicateTypes.filter(
        (t) => t !== type
      );
    } else {
      this.showOnlyDuplicateTypes = [...this.showOnlyDuplicateTypes, type];
    }
    this.applyCardsFilters();
  }

  applyCardsFilters() {
    const term = String(this.cardsSearchControl.value || '')
      .trim()
      .toLowerCase();
    this.cardsSearchTerm = term;
    this.cardDuplicateEntries = [];
    this.creditOverlapEntries = [];

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
    const afterSearch = term
      ? ((withPhone as any[]).filter(
          (c) =>
            `${c.firstName || ''} ${c.middleName || ''} ${c.lastName || ''}`
              .toLowerCase()
              .includes(term) ||
            (c.phoneNumber || '').includes(term)
        ) as Card[])
      : (withPhone as Card[]);

    const duplicateInfo = this.partitionCardDuplicates(afterSearch);
    this.cardsPotentialDuplicateCount = duplicateInfo.totalDuplicateCount;
    this.cardDuplicateEntries = duplicateInfo.duplicates;

    const deduped = this.excludeDuplicatePhones
      ? duplicateInfo.unique
      : afterSearch;

    this.cardsDuplicateCount = afterSearch.length - deduped.length;

    const creditInfo = this.filterCreditOverlap(deduped);
    this.cardsCreditOverlapCount = creditInfo.overlap;
    this.cardsCreditOverlapRemoved = creditInfo.removed;
    this.creditOverlapEntries = creditInfo.overlapEntries;

    const baseFiltered = creditInfo.filtered;
    this.cardsFiltered = this.applyDuplicateViewSelection(baseFiltered);

    if (this.cardBulkModal.open) {
      this.updateCardBulkRecipients();
    }
  }

  get cardsListSummary(): string {
    const count = this.cardsFiltered.length;
    const total = this.cardsAll?.length ?? count;
    if (this.showOnlyDuplicateTypes.length > 0) {
      const segments: string[] = [];
      if (this.showOnlyDuplicateTypes.includes('card')) {
        segments.push(`${this.cardDuplicateEntries.length} doublon(s) carte`);
      }
      if (this.showOnlyDuplicateTypes.includes('credit')) {
        segments.push(
          `${this.creditOverlapEntries.length} doublon(s) crédit`
        );
      }
      const detail = segments.length ? segments.join(' + ') : '—';
      return `Vue doublons (${detail}) · ${count} client(s)`;
    }
    if (this.cardsSearchTerm.trim().length > 0) {
      return `Résultats de la recherche · ${count} client(s)`;
    }
    if (count === total) {
      return `Tous les clients carte · ${total} client(s)`;
    }
    return `Sélection actuelle · ${count} client(s)`;
  }

  private applyDuplicateViewSelection(base: Card[]): Card[] {
    if (this.showOnlyDuplicateTypes.length === 0) return base;

    const includeCard = this.showOnlyDuplicateTypes.includes('card');
    const includeCredit = this.showOnlyDuplicateTypes.includes('credit');

    const pool: Card[] = [];
    if (includeCard) pool.push(...this.cardDuplicateEntries);
    if (includeCredit) pool.push(...this.creditOverlapEntries);

    if (pool.length === 0) return [];

    return this.uniqueCardsByIdentity(pool);
  }

  private matchesCardBirthday(card: Card): boolean {
    return true;
  }

  private extractMonthDayVariants(input: string | undefined | null) {
    if (!input) return [];
    const parts = input.match(/\d+/g);
    if (!parts || parts.length < 2) return [];

    const nums = parts.map((p) => Number(p));
    const results: Array<{ month: number; day: number }> = [];
    const seen = new Set<string>();

    const addCandidate = (month?: number, day?: number) => {
      if (
        month == null ||
        day == null ||
        !Number.isFinite(month) ||
        !Number.isFinite(day)
      )
        return;
      if (month < 1 || month > 12) return;
      if (day < 1 || day > 31) return;
      const key = `${month}-${day}`;
      if (!seen.has(key)) {
        results.push({ month, day });
        seen.add(key);
      }
    };

    const [a, b, c] = nums;
    if (nums.length >= 3) {
      if (a > 31) addCandidate(b, c); // yyyy-mm-dd
      if (a >= 1 && a <= 31 && b >= 1 && b <= 12) addCandidate(b, a); // dd-mm-yyyy
      if (b > 12 && a <= 12) addCandidate(a, b); // mm-dd-yyyy
      if (a > 31) addCandidate(c, b); // yyyy-dd-mm
      if (c > 31) addCandidate(a, b); // mm-dd-yyyy (year last)
      addCandidate(b, c);
      addCandidate(c, b);
    } else {
      addCandidate(a, b);
      addCandidate(b, a);
    }

    return results;
  }

  private formatCardBirthdayDateForDisplay(target: {
    month: number;
    day: number;
  }) {
    const date = new Date(2000, target.month - 1, target.day);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
  }

  private createTargetFromDate(date: Date) {
    return {
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  private toMonthDayFromDateInput(value: string) {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length < 3) return null;
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { month, day };
  }

  private partitionCardDuplicates(list: Card[]) {
    const unique: Card[] = [];
    const duplicates: Card[] = [];
    const groups = new Map<string, Card[]>();
    const seenDigits = new Set<string>();

    list.forEach((card) => {
      const digits = this.normalizePhoneDigits((card as any)?.phoneNumber);
      if (!digits) {
        unique.push(card);
        return;
      }
      const group = groups.get(digits);
      if (group) {
        group.push(card);
      } else {
        groups.set(digits, [card]);
      }
      if (!seenDigits.has(digits)) {
        unique.push(card);
        seenDigits.add(digits);
      }
    });

    let totalDuplicateCount = 0;

    for (const [digits, group] of groups.entries()) {
      if (group.length > 1) {
        duplicates.push(...group);
        totalDuplicateCount += group.length - 1;
      }
    }

    return { unique, duplicates, totalDuplicateCount };
  }

  private filterCreditOverlap(list: Card[]) {
    if (!this.creditClientPhones.size) {
      return {
        filtered: [...list],
        removed: 0,
        overlap: 0,
        overlapEntries: [] as Card[],
      };
    }

    const filtered: Card[] = [];
    const overlapEntries: Card[] = [];
    let overlap = 0;
    let removed = 0;

    for (const c of list as any[]) {
      const digits = this.normalizePhoneDigits(c?.phoneNumber);
      if (digits && this.creditClientPhones.has(digits)) {
        overlap += 1;
        overlapEntries.push(c);
        if (this.excludeCreditOverlap) {
          removed += 1;
          continue;
        }
      }
      filtered.push(c);
    }

    return { filtered, removed, overlap, overlapEntries };
  }

  private uniqueCardsByIdentity(list: Card[]): Card[] {
    const seen = new Set<string>();
    const out: Card[] = [];
    for (const card of list) {
      const key = this.cardIdentityKey(card);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(card);
    }
    return out;
  }

  private cardIdentityKey(c: Card): string {
    const digits =
      this.normalizePhoneDigits((c as any)?.phoneNumber) || 'no-phone';
    return c.uid || c.trackingId || `${c.firstName || ''}-${c.lastName || ''}-${digits}`;
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
Mutungisi eza te, Fondation ya biso na biso
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

  get totalCardClients(): number {
    return Number(this.summaryContent?.[0] ?? 0);
  }

  get activeCardClients(): number {
    return Number(this.summaryContent?.[1] ?? 0);
  }

  get totalSavingsToReturn(): number {
    return Number(this.summaryContent?.[2] ?? 0);
  }

  private normalizePhoneDigits(raw: any): string | null {
    if (raw === null || raw === undefined) return null;
    const digits = String(raw).replace(/\D/g, '');
    return digits.length ? digits : null;
  }

}
