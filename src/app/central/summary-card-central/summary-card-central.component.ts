import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { FormControl } from '@angular/forms';
import {
  Subscription,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  map,
} from 'rxjs';
import { MessagingService } from 'src/app/services/messaging.service';
import {
  CardSmsSettings,
  CardSmsSettingsService,
  DEFAULT_CARD_SMS_MINIMUM_FC,
  normalizeCardSmsSettings,
} from 'src/app/services/card-sms-settings.service';

type BulkFailure = { client: Card; error: string };
type BulkResult = {
  total: number;
  succeeded: number;
  failed: number;
  failures: BulkFailure[];
};
type SendResult = { ok: boolean; text: string };
type BulkLogContext = 'card_clients' | 'custom';
type BulkMessageLogDocument = {
  type?: BulkLogContext | string;
  sentAt?: any;
  sentAtMs?: number;
  total: number;
  succeeded: number;
  failed: number;
  locationTotals?: Record<string, number>;
  template?: string;
  messagePreview?: string;
  conditionSummary?: string;
  sentBy?: string;
  sentById?: string | null;
};
type BulkMessageLog = BulkMessageLogDocument & {
  id: string;
  sentAtDate: Date;
  locationEntries: { name: string; count: number }[];
  typeLabel: string;
};
type ScheduledBulkStatus =
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'canceled'
  | 'failed';
type ScheduledBulkMessageDocument = {
  status: ScheduledBulkStatus;
  type?: BulkLogContext | string;
  scheduledForMs: number;
  scheduledForLocal: string;
  timeZone?: string;
  total: number;
  template?: string;
  messagePreview?: string;
  locationTotals?: Record<string, number>;
  conditionSummary?: string;
  createdAt?: any;
  createdAtMs?: number;
  createdBy?: string;
  createdById?: string | null;
  canceledAtMs?: number;
  sentAtMs?: number;
  succeeded?: number;
  failed?: number;
};
type ScheduledBulkMessage = ScheduledBulkMessageDocument & {
  id: string;
  scheduledForDate: Date;
  typeLabel: string;
  statusLabel: string;
  locationEntries: { name: string; count: number }[];
};

@Component({
  selector: 'app-summary-card-central',
  templateUrl: './summary-card-central.component.html',
  styleUrls: ['./summary-card-central.component.css'],
})
export class SummaryCardCentralComponent implements OnDestroy {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    public messaging: MessagingService,
    private fns: AngularFireFunctions,
    private afs: AngularFirestore,
    private cardSmsSettingsService: CardSmsSettingsService
  ) {}

  // Default to current clients; staff can still cycle to completed/all cards.
  doneFilter: 'exclude' | 'only' | 'all' = 'exclude';

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

  minAmountToPay = DEFAULT_CARD_SMS_MINIMUM_FC;

  cardSmsSettings: CardSmsSettings = normalizeCardSmsSettings(undefined);
  cardSmsEnabledInput = false;
  cardSmsThresholdInput = DEFAULT_CARD_SMS_MINIMUM_FC;
  cardSmsSettingsLoading = true;
  cardSmsSettingsSaving = false;
  cardSmsSettingsError = '';
  cardSmsSettingsSuccess = '';
  private cardSmsSettingsSub?: Subscription;
  private allUsersSub?: Subscription;
  private cardsDataSub?: Subscription;
  private creditClientsSub?: Subscription;

  cardUniqueLocations: string[] = [];
  cardSelectedLocations = new Set<string>();
  cardsSelectAll = true;
  excludeDuplicatePhones = false;
  cardsPotentialDuplicateCount = 0;
  cardsDuplicateCount = 0;
  cardsInvalidPhoneCount = 0;
  cardsBelowSmsThresholdCount = 0;
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
    scheduleAt: '' as string,
  };
  cardBulkSending = false;
  cardBulkScheduling = false;
  cardBulkScheduleResult: SendResult | null = null;
  bulkLogs: BulkMessageLog[] = [];
  bulkLogsLoading = false;
  bulkLogsError: string | null = null;
  showAllBulkLogs = false;
  private bulkLogsSub?: Subscription;
  scheduledBulkMessages: ScheduledBulkMessage[] = [];
  scheduledBulkLoading = false;
  scheduledBulkError: string | null = null;
  showAllScheduledBulk = false;
  private scheduledBulkSub?: Subscription;

  // placeholders
  cardPlaceholderTokens = [
    '{{FULL_NAME}}',
    '{{FIRST_NAME}}',
    '{{LOCATION_NAME}}',
    '{{MAX_AMOUNT}}',
  ];

  allCreditClients: Client[] = [];
  private creditClientPhones = new Set<string>();

  ngOnInit(): void {
    this.listenToCardSmsSettings();
    this.allUsersSub = this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      this.getAllClientsCard();
      this.getAllCreditClients();
    });
    this.listenToBulkLogs();
    this.listenToScheduledBulkMessages();
  }

  ngOnDestroy(): void {
    this.bulkLogsSub?.unsubscribe();
    this.scheduledBulkSub?.unsubscribe();
    this.cardSmsSettingsSub?.unsubscribe();
    this.allUsersSub?.unsubscribe();
    this.cardsDataSub?.unsubscribe();
    this.creditClientsSub?.unsubscribe();
  }

  private listenToCardSmsSettings(): void {
    this.cardSmsSettingsLoading = true;
    this.cardSmsSettingsSub?.unsubscribe();
    this.cardSmsSettingsSub = this.cardSmsSettingsService.settings$.subscribe({
      next: (settings) => {
        this.cardSmsSettings = settings;
        this.cardSmsEnabledInput = settings.enabled;
        this.cardSmsThresholdInput = settings.minimumAmountToPayFc;
        // Keep the dashboard's default selection aligned with the saved global
        // policy, including when an administrator intentionally lowers X.
        this.minAmountToPay = settings.minimumAmountToPayFc;
        this.cardSmsSettingsLoading = false;
        this.cardSmsSettingsError = '';
        if (this.cardsAll.length) this.applyCardsFilters();
      },
      error: (error) => {
        console.error('Card SMS settings load failed', error);
        this.cardSmsSettingsLoading = false;
        this.cardSmsSettingsError =
          'Impossible de charger le seuil. Les SMS automatiques restent en pause.';
      },
    });
  }

  async saveCardSmsSettings(): Promise<void> {
    if (!this.auth.isAdmin || this.cardSmsSettingsSaving) return;
    const threshold = Number(this.cardSmsThresholdInput);
    if (!Number.isInteger(threshold) || threshold <= 0) {
      this.cardSmsSettingsError =
        'Saisissez un seuil entier supérieur à zéro.';
      return;
    }

    const eligible = this.countCardsAtOrAbove(threshold);
    const action = this.cardSmsEnabledInput ? 'activer' : 'mettre en pause';
    const confirmed = window.confirm(
      `Confirmer le seuil SMS cartes à ${this.toFcDisplay(threshold)} FC et ${action} les envois automatiques ?\n\n${eligible} carte(s) atteignent actuellement ce seuil. La règle s'appliquera uniquement aux prochains événements.`
    );
    if (!confirmed) return;

    this.cardSmsSettingsSaving = true;
    this.cardSmsSettingsError = '';
    this.cardSmsSettingsSuccess = '';
    try {
      await this.cardSmsSettingsService.save(
        this.cardSmsEnabledInput,
        threshold,
        {
          uid: this.auth.currentUser?.uid || '',
          name: [
            this.auth.currentUser?.firstName,
            this.auth.currentUser?.lastName,
          ]
            .filter(Boolean)
            .join(' '),
        }
      );
      this.cardSmsSettingsSuccess = 'Règle SMS cartes sauvegardée.';
    } catch (error: any) {
      console.error('Card SMS settings save failed', error);
      this.cardSmsSettingsError =
        error?.message || 'Impossible de sauvegarder la règle.';
    } finally {
      this.cardSmsSettingsSaving = false;
    }
  }

  private countCardsAtOrAbove(threshold: number): number {
    return (this.allClientsCard || []).filter(
      (card) => Number(card.amountToPay) >= threshold
    ).length;
  }

  get cardSmsEligibleCount(): number {
    return this.countCardsAtOrAbove(this.cardSmsThresholdInput);
  }

  isCardSmsEligible(card: Card): boolean {
    return (
      this.cardSmsSettings.enabled &&
      this.cardMeetsSmsThreshold(card) &&
      this.hasValidCardPhone(card)
    );
  }

  private cardMeetsSmsThreshold(card: Card): boolean {
    return (
      Number(card.amountToPay) >= this.cardSmsSettings.minimumAmountToPayFc
    );
  }

  hasValidCardPhone(card: Card): boolean {
    return (
      String(card?.phoneNumber || '')
        .replace(/\D/g, '')
        .length === 10
    );
  }

  cardSmsIneligibilityReason(card: Card): string {
    if (!this.cardSmsSettings.enabled) return 'Les envois SMS sont en pause.';
    if (!this.cardMeetsSmsThreshold(card)) {
      return `Sous le seuil SMS global de ${this.toFcDisplay(
        this.cardSmsSettings.minimumAmountToPayFc
      )} FC.`;
    }
    if (!this.hasValidCardPhone(card)) {
      return 'Numéro invalide : exactement 10 chiffres sont requis.';
    }
    return '';
  }

  get cardBulkEligibleCount(): number {
    return this.cardsFiltered.filter((card) => this.isCardSmsEligible(card))
      .length;
  }

  // ======== FETCH & SUMMARY =========
  getAllClientsCard() {
    this.cardsDataSub?.unsubscribe();
    if (!this.allUsers.length) {
      this.filterAndInitializeClientsCard([]);
      return;
    }

    const siteCardStreams = this.allUsers.map((user) =>
      this.auth.getClientsCardOfAUser(user.uid!).pipe(
        map((clients) =>
          clients.map((card: any) => ({
            ...card,
            locationName: card.locationName || user.firstName,
            ownerUid: user.uid,
          }))
        )
      )
    );

    this.cardsDataSub = combineLatest(siteCardStreams).subscribe(
      (cardsBySite) =>
        this.filterAndInitializeClientsCard(cardsBySite.flat() as Card[])
    );
  }

  getAllCreditClients() {
    this.creditClientsSub?.unsubscribe();
    if (!this.allUsers.length) {
      this.initializeCreditClients([]);
      return;
    }

    const siteCreditStreams = this.allUsers.map((user) =>
      this.auth.getClientsOfAUser(user.uid!).pipe(
        map((clients) =>
          clients.map((client) => ({
            ...client,
            locationName: user.firstName,
          }))
        )
      )
    );

    this.creditClientsSub = combineLatest(siteCreditStreams).subscribe(
      (clientsBySite) =>
        this.initializeCreditClients(clientsBySite.flat() as Client[])
    );
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

    // 3) amountToPay visibility filter. SMS eligibility is intentionally
    // evaluated separately so lowering this value can reveal every card.
    const effectiveMinimum = Math.max(Number(this.minAmountToPay) || 0, 0);
    const withAmount = base.filter(
      (c) => this.amountToPay(c) >= effectiveMinimum
    );

    // 4) search. Keep invalid/missing phone numbers visible so staff can
    // identify and correct them; the SMS action remains disabled for them.
    const afterSearch = term
      ? ((withAmount as any[]).filter(
          (c) =>
            `${c.firstName || ''} ${c.middleName || ''} ${c.lastName || ''}`
              .toLowerCase()
              .includes(term) ||
            (c.phoneNumber || '').includes(term)
        ) as Card[])
      : (withAmount as Card[]);

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
    this.cardsInvalidPhoneCount = this.cardsFiltered.filter(
      (card) => !this.hasValidCardPhone(card)
    ).length;
    this.cardsBelowSmsThresholdCount = this.cardsFiltered.filter(
      (card) => !this.cardMeetsSmsThreshold(card)
    ).length;

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
    if (!this.isCardSmsEligible(c)) {
      window.alert(this.cardSmsIneligibilityReason(c));
      return;
    }
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
    return `${c.firstName || 'Client'}: Carte ekoki kopesa credit kino FC{{MAX_AMOUNT}}. Na {{LOCATION_NAME}}. Tel 0825333567. Fondation Gervais.`;
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
      await this.messaging.sendCardSMS({
        ownerUid: c.ownerUid,
        cardId: c.uid,
        message: text,
        metadata: {
          reason: 'invite_card_to_loan',
          clientName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
          locationName: c.locationName || null,
        },
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
    this.cardBulkModal.scheduleAt = '';
    this.cardBulkScheduleResult = null;
    this.applyDefaultCardBulkTemplate();
    this.updateCardBulkRecipients();
  }

  closeCardBulkModal() {
    this.cardBulkModal.open = false;
    this.cardBulkModal.message = '';
    this.cardBulkModal.recipients = [];
    this.cardBulkModal.result = null;
    this.cardBulkModal.scheduleAt = '';
    this.cardBulkSending = false;
    this.cardBulkScheduling = false;
    this.cardBulkScheduleResult = null;
  }

  applyDefaultCardBulkTemplate() {
    this.cardBulkModal.message = `{{FIRST_NAME}}: Carte ekoki kopesa credit kino FC{{MAX_AMOUNT}}. Na {{LOCATION_NAME}}. Tel 0825333567. Fondation Gervais.`;
  }

  updateCardBulkRecipients() {
    const list: Card[] = [];
    let excludedNoPhone = 0;

    for (const c of this.cardsFiltered as any[]) {
      if (!this.cardMeetsSmsThreshold(c)) continue;
      if (!this.hasValidCardPhone(c)) {
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
    const recipients = [...this.cardBulkModal.recipients];

    for (const c of recipients as any[]) {
      try {
        const text = this.personalizeCardMessage(this.cardBulkModal.message, c);
        await this.messaging.sendCardSMS({
          ownerUid: c.ownerUid,
          cardId: c.uid,
          message: text,
          metadata: {
            reason: 'invite_card_to_loan_bulk',
            clientName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
            locationName: c.locationName || null,
          },
        });
        succeeded += 1;
      } catch (e: any) {
        console.error('Bulk SMS error', e);
        failures.push({ client: c, error: e?.message || 'Échec d’envoi' });
      }
    }

    const total = recipients.length;
    this.cardBulkModal.result = {
      total,
      succeeded,
      failed: failures.length,
      failures,
    };
    this.cardBulkSending = false;

    const locationTotals = this.aggregateLocations(
      recipients,
      (client: any) => client.locationName
    );
    await this.logBulkMessage('card_clients', {
      total,
      succeeded,
      failed: failures.length,
      locationTotals,
      template: this.cardBulkModal.message,
      messagePreview: this.previewCardPersonalized(),
      conditionSummary: this.buildCardConditionsSummary(),
    });
  }

  async scheduleCardBulkSms() {
    if (
      !this.cardBulkModal.message?.trim() ||
      this.cardBulkModal.recipients.length === 0 ||
      !this.cardBulkModal.scheduleAt?.trim()
    )
      return;

    this.cardBulkScheduling = true;
    this.cardBulkScheduleResult = null;

    try {
      const recipients = this.cardBulkModal.recipients.map((c: any) => ({
        phoneNumber: c.phoneNumber!,
        message: this.personalizeCardMessage(this.cardBulkModal.message, c),
        ownerUid: c.ownerUid,
        cardId: c.uid,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        locationName: c.locationName || null,
      }));
      const locationTotals = this.aggregateLocations(
        this.cardBulkModal.recipients,
        (client: any) => client.locationName
      );
      await this.createScheduledBulkMessage({
        type: 'card_clients',
        scheduledForLocal: this.cardBulkModal.scheduleAt,
        recipients,
        template: this.cardBulkModal.message,
        messagePreview: this.previewCardPersonalized(),
        locationTotals,
        conditionSummary: this.buildCardConditionsSummary(),
      });
      this.cardBulkScheduleResult = {
        ok: true,
        text: 'Envoi groupé programmé.',
      };
    } catch (error) {
      console.error('Schedule card bulk SMS failed', error);
      this.cardBulkScheduleResult = {
        ok: false,
        text: 'Échec de la programmation.',
      };
    } finally {
      this.cardBulkScheduling = false;
    }
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
    const firstName = String(c.firstName || 'Client').trim() || 'Client';
    let out = msg
      .replace(/\{\{\s*FULL_NAME\s*\}\}/g, fullName)
      .replace(/\{\{\s*FIRST_NAME\s*\}\}/g, firstName)
      .replace(/\{\{\s*LOCATION_NAME\s*\}\}/g, c.locationName ?? 'site')
      // fixed default 400,000 FC for cards clients:
      .replace(/\{\{\s*MAX_AMOUNT\s*\}\}/g, this.toFcDisplay(400000));

    return out;
  }

  get visibleBulkLogs(): BulkMessageLog[] {
    if (this.showAllBulkLogs) return this.bulkLogs;
    return this.bulkLogs.slice(0, 2);
  }

  get hasMoreBulkLogs(): boolean {
    return this.bulkLogs.length > 2;
  }

  toggleBulkLogExpansion(): void {
    if (!this.hasMoreBulkLogs) return;
    this.showAllBulkLogs = !this.showAllBulkLogs;
  }

  trackBulkLog(index: number, log: BulkMessageLog): string {
    return log.id;
  }

  get visibleScheduledBulkMessages(): ScheduledBulkMessage[] {
    if (this.showAllScheduledBulk) return this.scheduledBulkMessages;
    return this.scheduledBulkMessages.slice(0, 2);
  }

  get hasMoreScheduledBulkMessages(): boolean {
    return this.scheduledBulkMessages.length > 2;
  }

  toggleScheduledBulkExpansion(): void {
    if (!this.hasMoreScheduledBulkMessages) return;
    this.showAllScheduledBulk = !this.showAllScheduledBulk;
  }

  async cancelScheduledBulkMessage(schedule: ScheduledBulkMessage): Promise<void> {
    if (schedule.status !== 'scheduled') return;
    const confirmCancel = window.confirm(
      'Annuler cet envoi groupé programmé ?'
    );
    if (!confirmCancel) return;

    try {
      const callable = this.fns.httpsCallable('cancelScheduledBulkMessage');
      await firstValueFrom(callable({ scheduleId: schedule.id }));
    } catch (error) {
      console.error('Cancel scheduled bulk failed', error);
      window.alert("Impossible d'annuler pour le moment.");
    }
  }

  async deleteScheduledBulkMessage(schedule: ScheduledBulkMessage): Promise<void> {
    const confirmDelete = window.confirm(
      'Supprimer définitivement cette programmation ?'
    );
    if (!confirmDelete) return;

    try {
      const callable = this.fns.httpsCallable('deleteScheduledBulkMessage');
      await firstValueFrom(callable({ scheduleId: schedule.id }));
    } catch (error) {
      console.error('Delete scheduled bulk failed', error);
      window.alert('Impossible de supprimer pour le moment.');
    }
  }

  formatScheduleLocalLabel(value?: string): string {
    if (!value) return '—';
    return value.replace('T', ' ');
  }

  get kinshasaNowLocal(): string {
    return this.formatDateTimeForTimeZone(new Date(), 'Africa/Kinshasa');
  }

  private listenToBulkLogs(): void {
    this.bulkLogsLoading = true;
    this.bulkLogsError = null;
    this.bulkLogsSub?.unsubscribe();

    this.bulkLogsSub = this.afs
      .collection<BulkMessageLogDocument>('bulk_message_logs', (ref) =>
        ref.orderBy('sentAtMs', 'desc').limit(100)
      )
      .snapshotChanges()
      .subscribe({
        next: (snaps) => {
          this.bulkLogs = snaps
            .map((snap) =>
              this.transformBulkLogDocument(
                snap.payload.doc.id,
                snap.payload.doc.data()
              )
            )
            .filter((log) => log.type === 'card_clients');
          this.bulkLogsLoading = false;
        },
        error: (error) => {
          console.error('Bulk log listener error', error);
          this.bulkLogsError = "Impossible de charger l'historique.";
          this.bulkLogsLoading = false;
        },
      });
  }

  private listenToScheduledBulkMessages(): void {
    this.scheduledBulkLoading = true;
    this.scheduledBulkError = null;
    this.scheduledBulkSub?.unsubscribe();

    this.scheduledBulkSub = this.afs
      .collection<ScheduledBulkMessageDocument>('scheduled_bulk_messages', (ref) =>
        ref.orderBy('scheduledForMs', 'desc').limit(30)
      )
      .snapshotChanges()
      .subscribe({
        next: (snaps) => {
          this.scheduledBulkMessages = snaps
            .map((snap) =>
              this.transformScheduledBulkDocument(
                snap.payload.doc.id,
                snap.payload.doc.data()
              )
            )
            .filter((schedule) => schedule.type === 'card_clients');
          this.scheduledBulkLoading = false;
        },
        error: (error) => {
          console.error('Scheduled bulk listener error', error);
          this.scheduledBulkError = 'Impossible de charger les programmations.';
          this.scheduledBulkLoading = false;
        },
      });
  }

  private transformBulkLogDocument(
    id: string,
    data: BulkMessageLogDocument | undefined
  ): BulkMessageLog {
    const safe: BulkMessageLogDocument = data ?? {
      total: 0,
      succeeded: 0,
      failed: 0,
    };
    const sentAtDate = new Date(this.coerceBulkLogTimestamp(safe));

    return {
      ...safe,
      id,
      sentAtDate,
      locationEntries: this.buildLocationEntries(safe.locationTotals),
      typeLabel: this.getLogTypeLabel(safe.type),
    };
  }

  private coerceBulkLogTimestamp(data: BulkMessageLogDocument): number {
    if (typeof data.sentAtMs === 'number') {
      return data.sentAtMs;
    }
    if (data.sentAt && typeof data.sentAt.toDate === 'function') {
      return data.sentAt.toDate().getTime();
    }
    return Date.now();
  }

  private transformScheduledBulkDocument(
    id: string,
    data: ScheduledBulkMessageDocument | undefined
  ): ScheduledBulkMessage {
    const safe: ScheduledBulkMessageDocument = data ?? {
      status: 'scheduled',
      scheduledForMs: Date.now(),
      scheduledForLocal: '',
      total: 0,
    };
    const scheduledForDate = new Date(safe.scheduledForMs || Date.now());

    return {
      ...safe,
      id,
      scheduledForDate,
      typeLabel: this.getLogTypeLabel(safe.type),
      statusLabel: this.getScheduleStatusLabel(safe.status),
      locationEntries: this.buildLocationEntries(safe.locationTotals),
    };
  }

  private getScheduleStatusLabel(status: ScheduledBulkStatus): string {
    switch (status) {
      case 'scheduled':
        return 'Programmé';
      case 'processing':
        return 'Envoi en cours';
      case 'sent':
        return 'Envoyé';
      case 'canceled':
        return 'Annulé';
      case 'failed':
        return 'Échec';
      default:
        return 'Programmé';
    }
  }

  private getLogTypeLabel(type?: BulkLogContext | string): string {
    switch (type) {
      case 'card_clients':
        return 'Clients carte';
      case 'custom':
        return 'Personnalisé';
      default:
        return 'Envoi groupé';
    }
  }

  private buildLocationEntries(
    totals?: Record<string, number>
  ): { name: string; count: number }[] {
    if (!totals) return [];
    return Object.entries(totals)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  private aggregateLocations<T>(
    items: T[],
    picker: (item: T) => string | null | undefined
  ): Record<string, number> {
    return items.reduce<Record<string, number>>((acc, item) => {
      const raw = picker(item);
      const key = raw && raw.trim() ? raw.trim() : 'Sans localisation';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  private buildCardConditionsSummary(): string {
    const lines: string[] = [
      `Statut terminé : ${this.doneFilterLabel()}`,
      `Seuil SMS global : ${this.toFcDisplay(
        this.cardSmsSettings.minimumAmountToPayFc
      )} FC`,
      `Filtre ponctuel : ${this.toFcDisplay(this.minAmountToPay || 0)} FC`,
      `Sites : ${
        this.cardSelectedLocationsArray.length
          ? this.cardSelectedLocationsArray.join(', ')
          : 'Aucun site'
      }`,
    ];

    if (this.cardsSearchTerm.trim()) {
      lines.push(`Recherche : ${this.cardsSearchTerm.trim()}`);
    }
    if (this.excludeDuplicatePhones) {
      lines.push('Numéros dupliqués : exclus');
    }
    if (this.excludeCreditOverlap) {
      lines.push('Doublons avec crédit : exclus');
    }
    return lines.join('\n');
  }

  private formatDateTimeForTimeZone(date: Date, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value;
    }
    return `${values['year']}-${values['month']}-${values['day']}T${values['hour']}:${values['minute']}`;
  }

  private async createScheduledBulkMessage(payload: {
    type: BulkLogContext;
    scheduledForLocal: string;
    recipients: {
      phoneNumber: string;
      message: string;
      ownerUid?: string;
      cardId?: string;
      name?: string;
      locationName?: string | null;
    }[];
    template: string;
    messagePreview?: string;
    locationTotals: Record<string, number>;
    conditionSummary?: string;
  }): Promise<void> {
    const user = this.auth.currentUser || {};
    const sentBy = `${user.firstName ?? ''} ${user.lastName ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');

    const callable = this.fns.httpsCallable('scheduleBulkMessage');
    await firstValueFrom(
      callable({
        type: payload.type,
        template: payload.template,
        messagePreview: payload.messagePreview ?? null,
        locationTotals: payload.locationTotals,
        conditionSummary: payload.conditionSummary ?? null,
        scheduledForLocal: payload.scheduledForLocal,
        timeZone: 'Africa/Kinshasa',
        recipients: payload.recipients,
        sentBy: sentBy || user.email || undefined,
        sentById: user.uid ?? null,
      })
    );
  }

  private async logBulkMessage(
    context: BulkLogContext,
    payload: {
      total: number;
      succeeded: number;
      failed: number;
      locationTotals: Record<string, number>;
      template: string;
      messagePreview?: string;
      conditionSummary?: string;
    }
  ): Promise<void> {
    const user = this.auth.currentUser || {};
    const sentBy = `${user.firstName ?? ''} ${user.lastName ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');

    try {
      const callable = this.fns.httpsCallable('recordBulkMessageLog');
      await firstValueFrom(
        callable({
          type: context,
          total: payload.total,
          succeeded: payload.succeeded,
          failed: payload.failed,
          locationTotals: payload.locationTotals,
          template: payload.template,
          messagePreview: payload.messagePreview ?? null,
          conditionSummary: payload.conditionSummary ?? null,
          sentBy: sentBy || user.email || undefined,
          sentById: user.uid ?? null,
        })
      );
    } catch (error) {
      console.error('Bulk log write failed', error);
    }
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
