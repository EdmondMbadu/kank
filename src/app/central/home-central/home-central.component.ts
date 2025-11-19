import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';
import { filter, map } from 'rxjs/operators';

type BulkFailure = { client: Client; error: string };
type BulkResult = {
  total: number;
  succeeded: number;
  failed: number;
  failures: BulkFailure[];
};
type SendResult = { ok: boolean; text: string };

// Contact types
type ContactDocument = {
  firstName: string;
  middleName?: string;
  lastName: string;
  phoneNumber: string;
  createdAt: number;
  updatedAt?: number;
  phoneDigits?: string;
  ownerId?: string;
  ownerName?: string;
};

type ContactEntry = ContactDocument & {
  id: string;
  docPath: string;
  ownerKey: string;
};

@Component({
  selector: 'app-home-central',
  templateUrl: './home-central.component.html',
  styleUrls: ['./home-central.component.css'],
})
export class HomeCentralComponent implements OnInit, OnDestroy {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    public compute: ComputationService,
    private data: DataService,
    private fns: AngularFireFunctions,
    public messaging: MessagingService,
    private afs: AngularFirestore
  ) {}

  isFetchingClients = false;
  currentClients: Array<Client[]> = [];
  allcurrentClientsWithDebts: Client[] = [];
  allCurrentClientsWithDebtsScheduledToPayToday: Client[] = [];
  allUsers: User[] = [];

  // master list search
  searchControl = new FormControl('');
  filteredItems: Client[] = [];
  birthdayFilterMode: 'all' | 'today' | 'tomorrow' | 'custom' = 'all';
  customBirthdayInput = '';
  private birthdayTarget: { month: number; day: number } | null = null;
  private searchTerm = '';
  paymentDayOptions: string[] = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  selectedPaymentDay: string | null = null;
  selectedPaymentDayTotal = 0;
  minCreditScore = 0;
  maxCreditScore = 100;
  loanAmountFilterValue: number | null = null;
  loanAmountFilterMode: 'min' | 'exact' = 'min';
  debtStatusFilter: 'all' | 'withDebt' | 'withoutDebt' = 'all';
  quitteStatusFilter: 'all' | 'quitte' | 'active' = 'all';
  starsFilter: 'all' | 'noStars' | 'withStars' | 'exact' = 'all';
  starsFilterValue: number | null = null;
  filteredDebtTotal = 0;

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
  masterSelectedLocations = new Set<string>();
  masterSelectAllLocations = true;

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

  generalBulkModal = {
    open: false,
    message: '' as string,
    recipients: [] as Client[],
    excludedNoPhone: 0,
    result: null as BulkResult | null,
  };
  generalBulkSending = false;

  placeholderTokens = [
    '{{FULL_NAME}}',
    '{{firstName}}',
    '{{lastName}}',
    '{{LOCATION_NAME}}',
    '{{MAX_AMOUNT}}',
    '{{CREDIT_SCORE}}',
  ];

  ngOnInit(): void {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      if (this.allUsers.length > 1) this.getAllClients();
    });
    
    // Initialize contacts for admin
    if (this.auth.isAdmin) {
      this.auth.user$
        .pipe(filter((user): user is User => Boolean(user)))
        .subscribe((user) => this.initializeContactsCollection(user));
    }
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
    this.setupSearch();
    this.applyClientFilters();

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
        this.searchTerm = term ? String(term) : '';
        this.applyClientFilters();
      });
  }

  setBirthdayFilter(mode: 'all' | 'today' | 'tomorrow' | 'custom') {
    this.birthdayFilterMode = mode;

    if (mode === 'all') {
      this.customBirthdayInput = '';
      this.birthdayTarget = null;
    } else if (mode === 'today') {
      this.customBirthdayInput = '';
      this.birthdayTarget = this.createTargetFromDate(new Date());
    } else if (mode === 'tomorrow') {
      this.customBirthdayInput = '';
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.birthdayTarget = this.createTargetFromDate(tomorrow);
    } else if (mode === 'custom') {
      this.birthdayTarget = this.toMonthDayFromDateInput(this.customBirthdayInput);
    }

    this.applyClientFilters();
  }

  onCustomBirthdayDateChange(event: Event) {
    const value =
      (event.target as HTMLInputElement | null)?.value?.trim() || '';
    this.customBirthdayInput = value;
    this.birthdayTarget = this.toMonthDayFromDateInput(value);
    this.birthdayFilterMode = 'custom';
    this.applyClientFilters();
  }

  isBirthdayFilter(mode: 'all' | 'today' | 'tomorrow' | 'custom') {
    return this.birthdayFilterMode === mode;
  }

  birthdayButtonClasses(mode: 'all' | 'today' | 'tomorrow' | 'custom') {
    return {
      'bg-emerald-500 text-white shadow-sm dark:bg-emerald-600 dark:text-white':
        this.isBirthdayFilter(mode),
      'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700':
        !this.isBirthdayFilter(mode),
    };
  }

  setPaymentDayFilter(day: string | null) {
    if (day === null) {
      if (this.selectedPaymentDay !== null) {
        this.selectedPaymentDay = null;
        this.applyClientFilters();
      }
      return;
    }

    const normalized = this.normalizePaymentDay(day);
    const nextValue =
      normalized && this.selectedPaymentDay === normalized ? null : normalized;

    if (this.selectedPaymentDay === nextValue) return;

    this.selectedPaymentDay = nextValue;
    this.applyClientFilters();
  }

  isPaymentDaySelected(day: string | null) {
    if (day === null) return this.selectedPaymentDay === null;
    const normalized = this.normalizePaymentDay(day);
    return (
      !!normalized &&
      !!this.selectedPaymentDay &&
      normalized === this.selectedPaymentDay
    );
  }

  paymentDayButtonClasses(day: string | null) {
    const isActive = this.isPaymentDaySelected(day);
    return {
      'bg-emerald-500 text-white shadow-sm dark:bg-emerald-600 dark:text-white': isActive,
      'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700':
        !isActive,
    };
  }

  displayPaymentDay(day: string | null) {
    if (!day) return 'Tous';
    return this.time.englishToFrenchDay?.[day] || day;
  }

  debtStatusButtonClasses(mode: 'all' | 'withDebt' | 'withoutDebt') {
    return {
      'bg-emerald-500 text-white shadow-sm dark:bg-emerald-600 dark:text-white':
        this.isDebtStatusFilter(mode),
      'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700':
        !this.isDebtStatusFilter(mode),
    };
  }

  quitteStatusButtonClasses(mode: 'all' | 'quitte' | 'active') {
    return {
      'bg-emerald-500 text-white shadow-sm dark:bg-emerald-600 dark:text-white':
        this.isQuitteStatusFilter(mode),
      'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700':
        !this.isQuitteStatusFilter(mode),
    };
  }

  get birthdayFilterSummary(): string | null {
    switch (this.birthdayFilterMode) {
      case 'today':
        return this.birthdayTarget
          ? "Anniversaires d'aujourd'hui"
          : null;
      case 'tomorrow':
        return this.birthdayTarget ? 'Anniversaires de demain' : null;
      case 'custom':
        if (!this.birthdayTarget) return null;
        const formatted = this.formatBirthdayDateForDisplay(this.birthdayTarget);
        return formatted ? `Anniversaires du ${formatted}` : null;
      default:
        return null;
    }
  }

  get clientListSummaryBase(): string {
    const count = this.filteredItems.length;
    const hasSearch = this.searchTerm.trim().length > 0;
    const baseTotal = this.allClients?.length ?? count;
    const hasScoreFilter = Number(this.minCreditScore) > 0 || (Number.isFinite(Number(this.maxCreditScore)) && Number(this.maxCreditScore) !== 100);
    const hasLoanFilter =
      this.loanAmountFilterValue !== null && this.loanAmountFilterValue > 0;
    const hasDebtFilter = this.debtStatusFilter !== 'all';
    const hasQuitteFilter = this.quitteStatusFilter !== 'all';
    const hasPaymentDayFilter = !!this.selectedPaymentDay;
    const hasLocationFilter = !this.masterSelectAllLocations;

    const isDefaultView =
      !this.birthdayFilterSummary &&
      !hasSearch &&
      !hasScoreFilter &&
      !hasLoanFilter &&
      !hasDebtFilter &&
      !hasQuitteFilter &&
      !hasPaymentDayFilter &&
      !hasLocationFilter;

    if (isDefaultView) {
      return `Tous les clients · ${baseTotal} client(s)`;
    }

    const parts: string[] = [];
    if (this.birthdayFilterSummary) {
      parts.push(this.birthdayFilterSummary);
    } else if (hasSearch) {
      parts.push('Résultats de la recherche');
    } else {
      parts.push('Tous les clients');
    }

    if (hasScoreFilter) {
      const max = Number(this.maxCreditScore);
      const hasMax = Number.isFinite(max) && max !== 100;
      if (this.minCreditScore > 0 && hasMax) {
        parts.push(`Score ${this.minCreditScore}-${this.maxCreditScore}`);
      } else if (this.minCreditScore > 0) {
        parts.push(`Score ≥ ${this.minCreditScore}`);
      } else if (hasMax) {
        parts.push(`Score ≤ ${this.maxCreditScore}`);
      }
    }
    if (hasLoanFilter && this.loanAmountFilterValue !== null) {
      const comparator = this.loanAmountFilterMode === 'exact' ? '=' : '≥';
      parts.push(
        `Prêt ${comparator} FC ${this.formatFc(this.loanAmountFilterValue)}`
      );
    }
    if (hasDebtFilter) {
      parts.push(
        this.debtStatusFilter === 'withDebt'
          ? 'Avec dette > 0'
          : 'Dettes réglées'
      );
    }
    if (hasQuitteFilter) {
      parts.push(
        this.quitteStatusFilter === 'quitte'
          ? 'Statut « Quitté »'
          : 'Statut ≠ « Quitté »'
      );
    }
    if (hasPaymentDayFilter && this.selectedPaymentDay) {
      parts.push(`Paiement : ${this.displayPaymentDay(this.selectedPaymentDay)}`);
    }
    if (hasLocationFilter) {
      parts.push(
        `${this.masterSelectedLocations.size} site(s)`
      );
    }

    parts.push(`${count} client(s)`);
    return parts.join(' · ');
  }

  private applyClientFilters() {
    const base = (this.allClients ?? [])
      .filter((client) => this.matchesSearchTerm(client, this.searchTerm))
      .filter((client) => this.matchesCreditScore(client))
      .filter((client) => this.matchesLoanAmount(client))
      .filter((client) => this.matchesDebtStatus(client))
      .filter((client) => this.matchesQuitteStatus(client))
      .filter((client) => this.matchesMasterLocation(client))
      .filter((client) => this.matchesPaymentDay(client))
      .filter((client) => this.matchesStarsFilter(client));

    this.filteredItems = base.filter((client) => this.matchesBirthdayFilter(client));
    this.filteredDebtTotal = this.calculateFilteredDebtTotal(this.filteredItems);
    this.updateSelectedPaymentDayTotal();
    if (this.generalBulkModal.open) this.updateGeneralBulkRecipients();
  }

  private matchesSearchTerm(client: Client, rawTerm: string): boolean {
    const term = rawTerm.trim().toLowerCase();
    if (!term) return true;

    const fields = [
      client.firstName,
      client.lastName,
      client.middleName,
      client.phoneNumber,
      client.locationName,
    ];

    return fields.some((f) => (f || '').toLowerCase().includes(term));
  }

  onCreditScoreChange(rawValue: number | string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      this.minCreditScore = 0;
    } else {
      const newMin = Math.max(Math.round(value), 0);
      this.minCreditScore = Math.min(newMin, this.maxCreditScore);
      // Ensure max is at least equal to min
      if (this.maxCreditScore < this.minCreditScore) {
        this.maxCreditScore = this.minCreditScore;
      }
    }
    this.applyClientFilters();
  }

  onMaxCreditScoreChange(rawValue: number | string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      this.maxCreditScore = 100;
    } else {
      const newMax = Math.max(Math.round(value), this.minCreditScore);
      this.maxCreditScore = newMax;
      // Ensure min is at most equal to max
      if (this.minCreditScore > this.maxCreditScore) {
        this.minCreditScore = this.maxCreditScore;
      }
    }
    this.applyClientFilters();
  }

  onLoanAmountChange(rawValue: number | string | null) {
    if (rawValue === null || rawValue === '') {
      this.loanAmountFilterValue = null;
      this.applyClientFilters();
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.loanAmountFilterValue = null;
    } else {
      this.loanAmountFilterValue = Math.round(parsed);
    }
    this.applyClientFilters();
  }

  setLoanAmountFilterMode(mode: 'min' | 'exact') {
    if (this.loanAmountFilterMode === mode) return;
    this.loanAmountFilterMode = mode;
    this.applyClientFilters();
  }

  isLoanAmountFilterMode(mode: 'min' | 'exact') {
    return this.loanAmountFilterMode === mode;
  }

  clearLoanAmountFilter() {
    if (this.loanAmountFilterValue === null) return;
    this.loanAmountFilterValue = null;
    this.applyClientFilters();
  }

  setDebtStatusFilter(mode: 'all' | 'withDebt' | 'withoutDebt') {
    if (this.debtStatusFilter === mode) return;
    this.debtStatusFilter = mode;
    this.applyClientFilters();
  }

  isDebtStatusFilter(mode: 'all' | 'withDebt' | 'withoutDebt') {
    return this.debtStatusFilter === mode;
  }

  setQuitteStatusFilter(mode: 'all' | 'quitte' | 'active') {
    if (this.quitteStatusFilter === mode) return;
    this.quitteStatusFilter = mode;
    this.applyClientFilters();
  }

  isQuitteStatusFilter(mode: 'all' | 'quitte' | 'active') {
    return this.quitteStatusFilter === mode;
  }

  private matchesCreditScore(client: Client): boolean {
    const min = Number(this.minCreditScore) || 0;
    const max = Number(this.maxCreditScore);
    const score = Number(client.creditScore);
    if (!Number.isFinite(score)) return false;
    if (!Number.isFinite(max)) return score >= min; // If max is not set, only check min
    return score >= min && score <= max;
  }

  private matchesLoanAmount(client: Client): boolean {
    const target = this.loanAmountFilterValue;
    if (target === null || target <= 0) return true;

    const parseAmount = (value: string | number | undefined | null) => {
      if (value === undefined || value === null) return null;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]/g, '').trim();
        if (!cleaned) return null;
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      }
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const amount = [client.loanAmount, client.amountToPay, client.requestAmount]
      .map((value) => parseAmount(value))
      .find((num) => num !== null);

    if (amount === undefined || amount === null) return false;

    if (this.loanAmountFilterMode === 'exact') {
      return amount === target;
    }
    return amount >= target;
  }

  private matchesDebtStatus(client: Client): boolean {
    switch (this.debtStatusFilter) {
      case 'withDebt':
        return this.clientHasDebtLeft(client);
      case 'withoutDebt':
        return !this.clientHasDebtLeft(client);
      default:
        return true;
    }
  }

  private clientHasDebtLeft(client: Client): boolean {
    const raw = client.debtLeft ?? client.debtInProcess ?? 0;
    const num = Number(String(raw).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(num)) return false;
    return num > 0;
  }

  private matchesQuitteStatus(client: Client): boolean {
    const status = (client.vitalStatus || '').trim();
    switch (this.quitteStatusFilter) {
      case 'quitte':
        return status === 'Quitté';
      case 'active':
        return status !== 'Quitté';
      default:
        return true;
    }
  }

  private matchesMasterLocation(client: Client): boolean {
    if (this.masterSelectAllLocations || this.masterSelectedLocations.size === 0)
      return true;
    const loc = client.locationName || '';
    return this.masterSelectedLocations.has(loc);
  }

  private matchesPaymentDay(client: Client): boolean {
    if (!this.selectedPaymentDay) return true;
    const clientDay = this.normalizePaymentDay(client.paymentDay);
    if (!clientDay) return false;
    return clientDay === this.selectedPaymentDay;
  }

  private matchesStarsFilter(client: Client): boolean {
    const starsCount = this.getStarsCount(client);
    
    switch (this.starsFilter) {
      case 'noStars':
        return starsCount === 0;
      case 'withStars':
        return starsCount > 0;
      case 'exact':
        if (this.starsFilterValue === null) return true;
        return starsCount === this.starsFilterValue;
      default:
        return true;
    }
  }

  setStarsFilter(mode: 'all' | 'noStars' | 'withStars' | 'exact') {
    if (this.starsFilter === mode) {
      // If clicking the same mode, toggle to 'all' if it's not already
      if (mode !== 'all') {
        this.starsFilter = 'all';
        this.starsFilterValue = null;
        this.applyClientFilters();
      }
      return;
    }
    this.starsFilter = mode;
    if (mode !== 'exact') {
      this.starsFilterValue = null;
    }
    this.applyClientFilters();
  }

  isStarsFilter(mode: 'all' | 'noStars' | 'withStars' | 'exact') {
    return this.starsFilter === mode;
  }

  starsFilterButtonClasses(mode: 'all' | 'noStars' | 'withStars' | 'exact') {
    return {
      'bg-emerald-500 text-white shadow-sm dark:bg-emerald-600 dark:text-white':
        this.isStarsFilter(mode),
      'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700':
        !this.isStarsFilter(mode),
    };
  }

  onStarsFilterValueChange(rawValue: number | string | null) {
    if (rawValue === null || rawValue === '') {
      this.starsFilterValue = null;
      if (this.starsFilter === 'exact') {
        this.starsFilter = 'all';
      }
      this.applyClientFilters();
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      this.starsFilterValue = null;
    } else {
      this.starsFilterValue = Math.round(parsed);
      this.starsFilter = 'exact';
    }
    this.applyClientFilters();
  }

  clearStarsFilter() {
    this.starsFilter = 'all';
    this.starsFilterValue = null;
    this.applyClientFilters();
  }

  private normalizePaymentDay(day: string | undefined | null): string | null {
    if (!day) return null;
    const trimmed = day.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();

    const englishMatch = this.paymentDayOptions.find(
      (opt) => opt.toLowerCase() === lower
    );
    if (englishMatch) return englishMatch;

    for (const [eng, fr] of Object.entries(this.time.englishToFrenchDay)) {
      if (fr.toLowerCase() === lower) return eng;
    }

    return trimmed;
  }

  private calculateFilteredDebtTotal(list: Client[]): number {
    if (!list || list.length === 0) return 0;
    return list.reduce((sum, client) => {
      const debt = this.parseDebtLeft(client.debtLeft);
      return sum + (debt > 0 ? debt : 0);
    }, 0);
  }

  private updateSelectedPaymentDayTotal() {
    if (!this.selectedPaymentDay) {
      this.selectedPaymentDayTotal = 0;
      return;
    }

    const total = this.filteredItems.reduce((sum, client) => {
      const expected = this.expectedPaymentForClient(client);
      return sum + (expected > 0 ? expected : 0);
    }, 0);

    this.selectedPaymentDayTotal = Math.max(total, 0);
  }

  private expectedPaymentForClient(client: Client): number {
    const amountToPay = this.parseMonetary(client.amountToPay);
    const amountPaid = this.parseMonetary(client.amountPaid);
    const debtLeft = this.parseMonetary(client.debtLeft);
    const paymentPeriod = Number(client.paymentPeriodRange);

    const remaining = Math.max(amountToPay - amountPaid, 0);
    const basePayment =
      Number.isFinite(paymentPeriod) && paymentPeriod > 0
        ? amountToPay / paymentPeriod
        : 0;

    let due = Number.isFinite(basePayment) && basePayment > 0 ? basePayment : 0;

    if (due <= 0) {
      due = remaining;
    }

    if (debtLeft > 0 && (due <= 0 || debtLeft < due)) {
      due = debtLeft;
    }

    if (remaining > 0 && (due <= 0 || due > remaining)) {
      due = remaining;
    }

    return due > 0 && Number.isFinite(due) ? due : 0;
  }

  private parseMonetary(value: string | number | undefined | null): number {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(/[^0-9.-]/g, '').trim();
      if (!normalized) return 0;
      const num = Number(normalized);
      return Number.isFinite(num) ? num : 0;
    }
    return 0;
  }

  private parseDebtLeft(value: string | number | undefined | null): number {
    if (value === undefined || value === null) return 0;
    const normalized = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : String(value);
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }

  get filteredDebtTotalFcDisplay(): string {
    return this.formatFc(this.filteredDebtTotal);
  }

  get filteredDebtTotalUsdDisplay(): string {
    const usdRaw = Number(
      this.compute.convertCongoleseFrancToUsDollars(
        this.filteredDebtTotal.toString()
      )
    );
    if (!Number.isFinite(usdRaw)) return '0';
    return usdRaw.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  get hasFilteredDebtTotal(): boolean {
    return this.filteredDebtTotal > 0;
  }

  get selectedPaymentDayTotalFcDisplay(): string {
    return this.formatFc(this.selectedPaymentDayTotal);
  }

  get selectedPaymentDayTotalUsdDisplay(): string {
    const usdRaw = Number(
      this.compute.convertCongoleseFrancToUsDollars(
        this.selectedPaymentDayTotal.toString()
      )
    );
    if (!Number.isFinite(usdRaw)) return '0';
    return usdRaw.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  get hasSelectedPaymentDayTotal(): boolean {
    return this.selectedPaymentDayTotal > 0;
  }

  private matchesBirthdayFilter(client: Client): boolean {
    if (this.birthdayFilterMode === 'all') return true;

    if (!this.birthdayTarget) return false;

    const variants = this.extractMonthDayVariants(client.birthDate);
    if (variants.length === 0) return false;

    return variants.some(
      (entry) =>
        entry.month === this.birthdayTarget!.month &&
        entry.day === this.birthdayTarget!.day
    );
  }

  private extractMonthDayVariants(input: string | undefined | null) {
    if (!input) return [];
    const parts = input.match(/\d+/g);
    if (!parts || parts.length < 2) return [];

    const nums = parts.map((p) => Number(p));

    const results: Array<{ month: number; day: number }> = [];
    const seen = new Set<string>();

    const addCandidate = (month: number | undefined, day: number | undefined) => {
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
      // Treat as yyyy-mm-dd
      if (a > 31) addCandidate(b, c);
      // Treat as mm-dd-yyyy
      if (c > 31) addCandidate(a, b);
      // Treat as dd-mm-yyyy
      if (a >= 1 && a <= 31 && b >= 1 && b <= 12) addCandidate(b, a);
      // Treat as yyyy-dd-mm
      if (a > 31) addCandidate(c, b);
      // Generic fallbacks
      addCandidate(a, b);
      addCandidate(b, a);
      addCandidate(b, c);
      addCandidate(c, b);
    } else {
      addCandidate(a, b);
      addCandidate(b, a);
    }

    return results;
  }

  private formatBirthdayDateForDisplay(target: { month: number; day: number }) {
    const date = new Date(2000, target.month - 1, target.day);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
  }

  private createTargetFromDate(date: Date): { month: number; day: number } {
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
    this.resetMasterLocationSelection(true);
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

  private resetMasterLocationSelection(all = true) {
    this.masterSelectedLocations.clear();
    if (all) {
      this.uniqueLocations.forEach((l) => this.masterSelectedLocations.add(l));
      this.masterSelectAllLocations = true;
    } else {
      this.masterSelectAllLocations = false;
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

  toggleMasterAllLocations() {
    this.masterSelectAllLocations = !this.masterSelectAllLocations;
    this.resetMasterLocationSelection(this.masterSelectAllLocations);
    this.applyClientFilters();
  }

  toggleMasterLocation(loc: string) {
    if (this.masterSelectedLocations.has(loc))
      this.masterSelectedLocations.delete(loc);
    else this.masterSelectedLocations.add(loc);
    this.masterSelectAllLocations =
      this.masterSelectedLocations.size === this.uniqueLocations.length;
    this.applyClientFilters();
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
      if (!this.hasDialablePhone(c)) {
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

  // ===== general custom bulk (master list) =====
  get generalEligibleCount(): number {
    return this.filteredItems.filter((c) => this.hasDialablePhone(c)).length;
  }

  openGeneralBulkModal() {
    this.generalBulkModal.open = true;
    this.generalBulkModal.result = null;
    this.applyGeneralDefaultTemplate();
    this.updateGeneralBulkRecipients();
  }

  closeGeneralBulkModal() {
    this.generalBulkModal.open = false;
    this.generalBulkModal.message = '';
    this.generalBulkModal.recipients = [];
    this.generalBulkModal.result = null;
    this.generalBulkSending = false;
  }

  applyGeneralDefaultTemplate() {
    this.generalBulkModal.message = `Mbote {{FULL_NAME}},
Nous suivons ta situation au sein de FONDATION GERVAIS (site {{LOCATION_NAME}}).
Contacte vite ton agent pour actualiser ta situation.
Merci pour ta confiance !`;
  }

  updateGeneralBulkRecipients() {
    const list: Client[] = [];
    let excluded = 0;
    for (const c of this.filteredItems) {
      if (this.hasDialablePhone(c)) list.push(c);
      else excluded += 1;
    }
    this.generalBulkModal.recipients = list;
    this.generalBulkModal.excludedNoPhone = excluded;
  }

  async sendGeneralBulkSms() {
    if (
      !this.generalBulkModal.message?.trim() ||
      this.generalBulkModal.recipients.length === 0
    )
      return;

    this.generalBulkSending = true;
    const failures: BulkFailure[] = [];
    let succeeded = 0;

    for (const c of this.generalBulkModal.recipients) {
      try {
        const text = this.personalizeMessage(this.generalBulkModal.message, c);
        await this.messaging.sendCustomSMS(c.phoneNumber!, text, {
          reason: 'custom_general_filters',
          clientId: c.trackingId || c.uid || null,
          clientName: `${c.firstName} ${c.lastName}`.trim(),
          locationName: c.locationName || null,
        });
        succeeded += 1;
      } catch (e: any) {
        console.error('General bulk SMS error', e);
        failures.push({ client: c, error: e?.message || 'Échec d’envoi' });
      }
    }

    const total = this.generalBulkModal.recipients.length;
    this.generalBulkModal.result = {
      total,
      succeeded,
      failed: failures.length,
      failures,
    };
    this.generalBulkSending = false;
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
  getStarsCount(client: Client | null | undefined): number {
    if (!client || !client.stars) return 0;
    const count = Number(client.stars);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }
  private hasDialablePhone(client: Client | null | undefined): boolean {
    if (!client || !client.phoneNumber) return false;
    return ('' + client.phoneNumber).replace(/\D/g, '').length >= 10;
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
  generalPreviewPersonalized() {
    const first = this.generalBulkModal.recipients?.[0];
    return first
      ? this.personalizeMessage(this.generalBulkModal.message, first)
      : '—';
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
    const creditScore = Number(c.creditScore) || 0;
    let out = msg
      .replace(/\{\{\s*FULL_NAME\s*\}\}/g, fullName)
      .replace(/\{\{\s*firstName\s*\}\}/g, c.firstName ?? '')
      .replace(/\{\{\s*lastName\s*\}\}/g, c.lastName ?? '')
      .replace(/\{\{\s*LOCATION_NAME\s*\}\}/g, c.locationName ?? 'site')
      .replace(/\{\{\s*CREDIT_SCORE\s*\}\}/g, creditScore.toString());

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

  get maxCreditScoreRange(): number {
    return Math.max(this.maxCreditScore, 100);
  }

  // ===== Contact list functionality =====
  contacts: ContactEntry[] = [];
  contactSearchTerm = '';
  filteredContacts: ContactEntry[] = [];
  contactAvailableLocations: { label: string; value: string }[] = [];
  private contactSelectedOwnerKeys = new Set<string>();
  private contactsCollection?: AngularFirestoreCollection<ContactDocument>;
  private contactsSub?: Subscription;

  // Contact SMS modal
  contactSmsModal = {
    open: false,
    contact: null as ContactEntry | null,
    message: '' as string,
  };
  contactSending = false;
  contactSendResult: SendResult | null = null;

  // Contact bulk SMS modal
  contactBulkModal = {
    open: false,
    message: '' as string,
    recipients: [] as ContactEntry[],
    excludedNoPhone: 0,
    result: null as BulkResult | null,
  };
  contactBulkSending = false;


  ngOnDestroy(): void {
    this.contactsSub?.unsubscribe();
  }

  private initializeContactsCollection(user: User): void {
    this.contactsSub?.unsubscribe();

    const collection$ = this.afs
      .collectionGroup<ContactDocument>('prise_contact', (ref) =>
        ref.orderBy('createdAt', 'desc')
      )
      .snapshotChanges();

    this.contactsSub = collection$
      .pipe(
        map((snaps) =>
          snaps.map((snap) => {
            const data = snap.payload.doc.data();
            const docPath = snap.payload.doc.ref.path;
            const ownerId =
              data.ownerId ?? this.extractOwnerIdFromPath(docPath) ?? undefined;
            const ownerName = data.ownerName ?? 'Non attribué';
            const ownerKey = this.buildOwnerKey(
              ownerId,
              ownerName,
              docPath
            );

            const contact: ContactEntry = {
              id: snap.payload.doc.id,
              docPath,
              firstName: data.firstName,
              middleName: data.middleName ?? '',
              lastName: data.lastName,
              phoneNumber: data.phoneNumber,
              createdAt: this.coerceToMillis(data.createdAt),
              updatedAt: data.updatedAt
                ? this.coerceToMillis(data.updatedAt)
                : undefined,
              phoneDigits: data.phoneDigits,
              ownerId,
              ownerName,
              ownerKey,
            };
            return contact;
          })
        )
      )
      .subscribe((contacts) => {
        this.contacts = contacts;
        this.updateContactAvailableLocations();
        this.applyContactFilters();
      });
  }

  private extractOwnerIdFromPath(path: string): string | undefined {
    const match = /^users\/([^/]+)\/prise_contact\/[^/]+$/.exec(path);
    return match?.[1];
  }

  private buildOwnerKey(
    ownerId: string | undefined,
    ownerName: string | undefined,
    docPath: string
  ): string {
    if (ownerId) return `id:${ownerId}`;
    const label = ownerName?.trim();
    if (label) return `name:${label.toLowerCase()}`;
    return `doc:${docPath}`;
  }

  private coerceToMillis(value: any): number {
    if (!value) return Date.now();
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    return Date.now();
  }

  private updateContactAvailableLocations(): void {
    const map = new Map<string, string>();
    this.contacts.forEach((contact) => {
      const label = contact.ownerName || 'Non attribué';
      if (!map.has(contact.ownerKey)) {
        map.set(contact.ownerKey, label);
      }
    });

    this.contactAvailableLocations = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const allowed = new Set(
      this.contactAvailableLocations.map((option) => option.value)
    );
    Array.from(this.contactSelectedOwnerKeys).forEach((value) => {
      if (!allowed.has(value)) this.contactSelectedOwnerKeys.delete(value);
    });
  }

  onContactSearchTermChange(): void {
    this.applyContactFilters();
  }

  toggleContactLocation(value: string): void {
    if (this.contactSelectedOwnerKeys.has(value)) {
      this.contactSelectedOwnerKeys.delete(value);
    } else {
      this.contactSelectedOwnerKeys.add(value);
    }
    this.applyContactFilters();
  }

  clearContactLocationFilters(): void {
    this.contactSelectedOwnerKeys.clear();
    this.applyContactFilters();
  }

  isContactLocationSelected(value: string): boolean {
    return this.contactSelectedOwnerKeys.has(value);
  }

  get hasActiveContactLocationFilter(): boolean {
    return this.contactSelectedOwnerKeys.size > 0;
  }

  private applyContactFilters(): void {
    const search = this.contactSearchTerm.trim();
    let base = this.contacts;

    if (this.contactSelectedOwnerKeys.size > 0) {
      base = base.filter((contact) =>
        this.contactSelectedOwnerKeys.has(contact.ownerKey)
      );
    }

    if (!search) {
      this.filteredContacts = base;
      if (this.contactBulkModal.open) this.updateContactBulkRecipients();
      return;
    }

    const normalizedSearch = search.toLowerCase();
    const digitSearch = normalizedSearch.replace(/\D/g, '');

    this.filteredContacts = base.filter((contact) => {
      const fullName = `${contact.firstName} ${contact.middleName ?? ''} ${contact.lastName}`
        .toLowerCase();
      const phoneDigits = (contact.phoneNumber ?? '').replace(/\D/g, '');
      return (
        (normalizedSearch.length > 0 && fullName.includes(normalizedSearch)) ||
        (digitSearch.length > 0 && phoneDigits.includes(digitSearch))
      );
    });
    
    if (this.contactBulkModal.open) this.updateContactBulkRecipients();
  }

  get contactFilteredTotal(): number {
    return this.filteredContacts.length;
  }

  async deleteContact(entry: ContactEntry): Promise<void> {
    const confirmDelete = window.confirm(
      `Supprimer ${entry.firstName} ${entry.lastName} de la liste ?`
    );
    if (!confirmDelete) return;

    try {
      await this.afs.doc<ContactDocument>(entry.docPath).delete();
    } catch (error) {
      console.error('Failed to delete contact', error);
      window.alert('Erreur lors de la suppression. Veuillez réessayer.');
    }
  }

  // ===== Contact SMS functionality =====
  openContactSmsModal(contact: ContactEntry) {
    this.contactSendResult = null;
    this.contactSmsModal.contact = contact;
    this.contactSmsModal.message = this.buildDefaultContactTemplate(contact);
    this.contactSmsModal.open = true;
  }

  closeContactSmsModal() {
    this.contactSmsModal.open = false;
    this.contactSmsModal.contact = null;
    this.contactSmsModal.message = '';
    this.contactSending = false;
    this.contactSendResult = null;
  }

  applyDefaultContactTemplate() {
    if (this.contactSmsModal.contact)
      this.contactSmsModal.message = this.buildDefaultContactTemplate(
        this.contactSmsModal.contact
      );
  }

  private buildDefaultContactTemplate(contact: ContactEntry): string {
    const loc = contact.ownerName || 'site';
    return `Bonjour ${contact.firstName} ${contact.lastName},
Nous serions ravis de vous accueillir chez Fondation Gervais ${loc}.
Passez nous voir pour finaliser votre inscription.
Merci pour votre confiance !`;
  }

  async sendSmsToContact() {
    if (
      !this.contactSmsModal.contact?.phoneNumber ||
      !this.contactSmsModal.message.trim()
    )
      return;
    this.contactSending = true;
    this.contactSendResult = null;

    try {
      await this.messaging.sendCustomSMS(
        this.contactSmsModal.contact.phoneNumber,
        this.contactSmsModal.message,
        {
          reason: 'contact_prospect_invitation',
          contactId: this.contactSmsModal.contact.id || null,
          contactOwnerId: this.contactSmsModal.contact.ownerId || null,
          contactName: `${this.contactSmsModal.contact.firstName} ${this.contactSmsModal.contact.lastName}`.trim(),
          locationName: this.contactSmsModal.contact.ownerName || null,
        }
      );
      this.contactSendResult = { ok: true, text: 'SMS envoyé avec succès.' };
    } catch (e) {
      console.error(e);
      this.contactSendResult = {
        ok: false,
        text: "Échec de l'envoi du SMS.",
      };
    } finally {
      this.contactSending = false;
    }
  }

  // ===== Contact Bulk SMS functionality =====
  openContactBulkModal() {
    this.contactBulkModal.open = true;
    this.contactBulkModal.result = null;
    this.contactBulkModal.message = this.defaultContactBulkTemplate();
    this.updateContactBulkRecipients();
  }

  closeContactBulkModal() {
    this.contactBulkModal.open = false;
    this.contactBulkModal.message = '';
    this.contactBulkModal.recipients = [];
    this.contactBulkModal.excludedNoPhone = 0;
    this.contactBulkModal.result = null;
    this.contactBulkSending = false;
  }

  private defaultContactBulkTemplate(): string {
    return `Mbote {{FULL_NAME}},
To sololaki nayo pono kotombola mombongo na yo. 
Soki olingi kobanda kozua crédit ya liboso, okoki kozua {{MAX_AMOUNT}} FC. 
Kende na FONDATION GERVAIS location {{LOCATION_NAME}}.
Merci pona confiance na FONDATION GERVAIS.`;
  }

  updateContactBulkRecipients() {
    const withPhones: ContactEntry[] = [];
    let excluded = 0;

    for (const contact of this.filteredContacts) {
      if (this.hasDialableContactPhone(contact)) {
        withPhones.push(contact);
      } else {
        excluded += 1;
      }
    }

    this.contactBulkModal.recipients = withPhones;
    this.contactBulkModal.excludedNoPhone = excluded;
  }

  private hasDialableContactPhone(contact: ContactEntry): boolean {
    if (!contact || !contact.phoneNumber) return false;
    const digits = ('' + contact.phoneNumber).replace(/\D/g, '');
    return digits.length >= 10;
  }

  get contactBulkPreviewMessage(): string {
    const first = this.contactBulkModal.recipients?.[0];
    if (!first || !this.contactBulkModal.message?.trim()) return '';
    return this.personalizeContactMessage(this.contactBulkModal.message, first);
  }

  private personalizeContactMessage(
    msg: string,
    contact: ContactEntry
  ): string {
    if (!msg) return '';
    const fullName = `${contact.firstName} ${contact.lastName}`.trim();
    const location = contact.ownerName || 'Fondation Gervais';
    const maxAmountForNewComers = 400000; // 400,000 FC for new contacts
    let out = msg
      .replace(/{{FULL_NAME}}/g, fullName)
      .replace(/{{firstName}}/g, contact.firstName || '')
      .replace(/{{lastName}}/g, contact.lastName || '')
      .replace(/{{LOCATION}}/g, location)
      .replace(/{{LOCATION_NAME}}/g, location)
      .replace(/\{\{\s*MAX_AMOUNT\s*\}\}/g, this.formatFc(maxAmountForNewComers));
    
    return out;
  }

  async sendContactBulkMessages(): Promise<void> {
    if (
      !this.contactBulkModal.message?.trim() ||
      this.contactBulkModal.recipients.length === 0
    )
      return;

    this.contactBulkSending = true;
    const failures: BulkFailure[] = [];
    let succeeded = 0;

    for (const contact of this.contactBulkModal.recipients) {
      try {
        const text = this.personalizeContactMessage(
          this.contactBulkModal.message,
          contact
        );
        await this.messaging.sendCustomSMS(contact.phoneNumber, text, {
          reason: 'contact_prospect_bulk_sms',
          contactId: contact.id || null,
          contactOwnerId: contact.ownerId ?? null,
          contactName: `${contact.firstName} ${contact.lastName}`.trim(),
          locationName: contact.ownerName || null,
        });
        succeeded += 1;
      } catch (error: any) {
        console.error('Contact bulk SMS error', error);
        failures.push({
          client: contact as any,
          error: error?.message || "Échec d'envoi",
        });
      }
    }

    const total = this.contactBulkModal.recipients.length;
    this.contactBulkModal.result = {
      total,
      succeeded,
      failed: failures.length,
      failures,
    };

    this.contactBulkSending = false;
  }

  get contactEligibleCount(): number {
    return this.filteredContacts.filter((c) =>
      this.hasDialableContactPhone(c)
    ).length;
  }
}
