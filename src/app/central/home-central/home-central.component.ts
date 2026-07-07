import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import {
  AuditConversationAudioAttachment,
  Client,
  ClientGalleryPicture,
  Comment,
} from 'src/app/models/client';
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

type BulkLogContext =
  | 'finished_clients'
  | 'general_filters'
  | 'birthday_tomorrow'
  | 'birthdays'
  | 'prospect_contacts'
  | 'contacts'
  | 'custom';

type BirthdayTomorrowGroup = {
  key: string;
  locationName: string;
  clients: Client[];
  recipients: Client[];
  excludedNoPhone: number;
};

type TrophyMissingGroup = {
  key: string;
  locationName: string;
  clients: Client[];
};

type BulkMessageLogDocument = {
  type?: BulkLogContext;
  source?: string;
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
  type?: BulkLogContext;
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

type PaymentReminderLogDocument = {
  source?: 'manual' | 'scheduled' | string;
  sendMode?: PaymentReminderSendMode | string;
  plannedTotal?: number;
  total?: number;
  succeeded?: number;
  failed?: number;
  quitteTotal?: number;
  quitteSucceeded?: number;
  excludedQuitte?: number;
  skipped?: number;
  sentAtDateKey?: string;
  sentAtMs?: number;
  sentAt?: any;
  sentBy?: string | null;
  sentById?: string | null;
};

type PaymentReminderLog = PaymentReminderLogDocument & {
  id: string;
  sentAtDate: Date;
  sourceLabel: string;
};

type PaymentReminderSummaryStats = {
  runs: number;
  planned: number;
  sent: number;
  failed: number;
  skipped: number;
  quittePlanned: number;
  quitteSent: number;
};

type PaymentReminderSendMode = 'all' | 'excludeQuitte';
type BirthdayAutomationDebtMode = 'all' | 'withDebt' | 'withoutDebt';
type BirthdayAutomationStatusMode = 'all' | 'excludeQuitte' | 'onlyQuitte';

type MasterClientFilterPanel =
  | 'paymentDay'
  | 'duplicatePhone'
  | 'audio'
  | 'debtStatus'
  | 'stars'
  | 'scoreLoan'
  | 'locations';

type TrophyMissingFilterMode = 'all' | 'missing';
type TopClientFocusPanel = 'trophyMissing';
type HomeCentralSection =
  | 'clients'
  | 'birthdays'
  | 'notPaid'
  | 'reminders'
  | 'relances'
  | 'contacts'
  | 'scheduled'
  | 'logs';
type CentralNotPaidMode = 'cycle' | 'noPay';

type CentralNotPaidGroup = {
  key: string;
  locationName: string;
  clients: Client[];
  totalDebt: number;
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
  activeHomeSection: HomeCentralSection = 'clients';
  homeSections: Array<{
    id: HomeCentralSection;
    label: string;
    eyebrow: string;
    adminOnly?: boolean;
  }> = [
    { id: 'clients', label: 'Tous les clients', eyebrow: 'Clients' },
    { id: 'birthdays', label: 'Anniversaires', eyebrow: 'Clients' },
    { id: 'notPaid', label: 'Retards paiement', eyebrow: 'Retards' },
    { id: 'reminders', label: 'Rappel collectif', eyebrow: 'Rappel' },
    { id: 'relances', label: 'Relances multi-sites', eyebrow: 'Relances' },
    {
      id: 'contacts',
      label: 'Contacts enregistrés',
      eyebrow: 'Prospects',
      adminOnly: true,
    },
    {
      id: 'scheduled',
      label: 'Messages programmés',
      eyebrow: 'Programmation',
    },
    { id: 'logs', label: 'Journaux', eyebrow: 'Historique' },
  ];
  scheduledReminderClientView: 'all' | 'quitte' | 'active' = 'all';
  scheduledReminderSendMode: PaymentReminderSendMode = 'all';
  scheduledReminderSettingsLoading = false;
  scheduledReminderSettingsSaving = false;
  scheduledReminderSettingsError: string | null = null;
  showAllScheduledReminderClients = false;
  allUsers: User[] = [];

  // master list search
  searchControl = new FormControl('');
  filteredItems: Client[] = [];
  showAllFilteredItems = false;
  activeClient: Client | null = null;
  showClientModal = false;
  showActiveClientHomePicture = false;
  selectedActiveClientGalleryPicture?: ClientGalleryPicture;
  phoneEditValue = '';
  phoneEditOpen = false;
  phoneEditSaving = false;
  showPhoneHistory = false;
  showRecentPaymentsExpanded = false;
  showRecentSavingsExpanded = false;
  showClientCommentsExpanded = false;
  showClientAuditAudioSectionExpanded = false;
  showClientAuditAudiosExpanded = false;
  expandedClientAudioKeys = new Set<string>();
  birthdayFilterMode: 'all' | 'today' | 'tomorrow' | 'custom' = 'tomorrow';
  customBirthdayInput = '';
  private birthdayTarget: { month: number; day: number } | null =
    this.createTomorrowBirthdayTarget();
  tomorrowBirthdayGroups: BirthdayTomorrowGroup[] = [];
  birthdayTomorrowResult: Record<string, SendResult | null> = {};
  birthdayTomorrowModal = {
    open: false,
    group: null as BirthdayTomorrowGroup | null,
    message: '' as string,
    scheduleAt: '' as string,
    result: null as SendResult | null,
  };
  birthdayTomorrowModalSending = false;
  birthdayTomorrowModalScheduling = false;
  birthdayBulkModal = {
    open: false,
    message: '',
    recipients: [] as Client[],
    excludedNoPhone: 0,
    result: null as BulkResult | null,
  };
  birthdayBulkSending = false;
  birthdayAutomationEnabled = false;
  birthdayAutomationSendTime = '09:00';
  birthdayAutomationDebtMode: BirthdayAutomationDebtMode = 'all';
  birthdayAutomationStatusMode: BirthdayAutomationStatusMode = 'excludeQuitte';
  birthdayAutomationSettingsLoading = false;
  birthdayAutomationSettingsSaving = false;
  birthdayAutomationSettingsError: string | null = null;
  birthdayHistoryMonth = this.formatMonthKeyForTimeZone(
    new Date(),
    'Africa/Kinshasa'
  );
  birthdayHistoryLogs: BulkMessageLog[] = [];
  birthdayHistoryLoading = false;
  birthdayHistoryError: string | null = null;
  birthdayHistoryWarning: string | null = null;
  birthdayAutomationDebtModes: BirthdayAutomationDebtMode[] = [
    'all',
    'withDebt',
    'withoutDebt',
  ];
  birthdayAutomationStatusModes: BirthdayAutomationStatusMode[] = [
    'excludeQuitte',
    'all',
    'onlyQuitte',
  ];
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
  activeTopClientFocusPanel: TopClientFocusPanel = 'trophyMissing';
  selectedPaymentDay: string | null = null;
  activeMasterFilterPanel: MasterClientFilterPanel = 'paymentDay';
  selectedPaymentDayTotal = 0;
  minCreditScore = 0;
  maxCreditScore = 100;
  loanAmountFilterValue: number | null = null;
  loanAmountFilterMode: 'min' | 'exact' = 'min';
  debtStatusFilter: 'all' | 'withDebt' | 'withoutDebt' = 'all';
  quitteStatusFilter: 'all' | 'quitte' | 'active' = 'all';
  starsFilter: 'all' | 'noStars' | 'withStars' | 'exact' = 'all';
  starsFilterValue: number | null = null;
  trophyMissingFilter: TrophyMissingFilterMode = 'all';
  duplicatePhoneFilter: 'all' | 'duplicates' = 'all';
  audioFilter: 'all' | 'withAudio' | 'withoutAudio' = 'all';
  duplicatePhoneDigits = new Set<string>();
  duplicatePhoneCounts: Record<string, number> = {};
  duplicatePhoneGroupsCount = 0;
  duplicatePhoneClientsCount = 0;
  duplicatePhoneGroups: Array<{ digits: string; clients: Client[] }> = [];
  duplicatePhoneUpdates: Record<string, string> = {};
  duplicatePhoneGroupUpdates: Record<string, string> = {};
  duplicatePhoneGroupCollapsed = new Set<string>();
  duplicatePhoneModal = {
    open: false,
    isSaving: false,
    error: '' as string | null,
    result: null as { updated: number; skipped: number; failed: number } | null,
  };
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
  showAllFinishedFiltered = false;
  fdSearchControl = new FormControl('');
  fdMinScore = 60;
  fdMaxScore = 100;

  uniqueLocations: string[] = [];
  selectedLocations = new Set<string>();
  selectAllLocations = true;
  masterSelectedLocations = new Set<string>();
  masterSelectAllLocations = true;
  centralNotPaidSelectedLocations = new Set<string>();
  centralNotPaidSelectAllLocations = true;
  centralNotPaidMode: CentralNotPaidMode = 'noPay';
  centralNotPaidMonth = this.currentMonthInputValue();
  centralNotPaidCycleMonthsThreshold = 7;
  centralNotPaidNoPayMonthsThreshold = 5;
  centralNotPaidIncludeQuitte = false;
  centralNotPaidShowAllClients = false;
  centralNotPaidSearchControl = new FormControl('');
  private centralNotPaidSearchInitialized = false;
  private centralNotPaidSearchTerm = '';
  centralNotPaidResults: Client[] = [];
  centralNotPaidGroups: CentralNotPaidGroup[] = [];
  centralNotPaidTotalDebt = 0;
  showAllCentralNotPaidResults = false;
  centralNotPaidStatusModal = {
    open: false,
    client: null as Client | null,
    saving: false,
    error: '',
  };

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
    scheduleAt: '' as string,
  };
  bulkSending = false;
  bulkScheduling = false;
  bulkScheduleResult: SendResult | null = null;

  generalBulkModal = {
    open: false,
    message: '' as string,
    recipients: [] as Client[],
    excludedNoPhone: 0,
    result: null as BulkResult | null,
    scheduleAt: '' as string,
  };
  generalBulkSending = false;
  generalBulkScheduling = false;
  generalBulkScheduleResult: SendResult | null = null;

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

    this.listenToBulkLogs();
    this.listenToBirthdayHistoryLogsForMonth();
    this.listenToScheduledBulkMessages();
    this.loadPaymentReminderLogsForDate();
    this.loadScheduledReminderSendMode();
    this.loadBirthdayAutomationSettings();
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
          locationOwnerId: c.locationOwnerId || user.uid,
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
    this.refreshTomorrowBirthdayGroups();

    this.initalizeInputs();
    this.setupSearch();
    this.buildDuplicatePhoneIndex();
    this.applyClientFilters();

    // build finished-debt dataset + filters
    this.buildFinishedAll();
    this.buildUniqueLocations();
    this.resetLocationSelection(true);
    this.resetCentralNotPaidLocationSelection(true);
    this.setupFdSearch();
    this.setupCentralNotPaidSearch();
    this.applyFinishedFilters();
    this.applyCentralNotPaidFilters();
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

  setActiveHomeSection(section: HomeCentralSection) {
    if (this.activeHomeSection === section) return;
    this.activeHomeSection = section;
  }

  isActiveHomeSection(section: HomeCentralSection) {
    return this.activeHomeSection === section;
  }

  homeSectionTabClasses(section: HomeCentralSection) {
    const isActive = this.isActiveHomeSection(section);
    return {
      'border-emerald-500 bg-emerald-600 text-white shadow-sm shadow-emerald-900/10':
        isActive,
      'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200':
        !isActive,
    };
  }

  private currentMonthInputValue(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${month}`;
  }

  get centralNotPaidActiveThreshold(): number {
    return this.centralNotPaidMode === 'cycle'
      ? this.centralNotPaidCycleMonthsThreshold
      : this.centralNotPaidNoPayMonthsThreshold;
  }

  get centralNotPaidModeLabel(): string {
    return this.centralNotPaidMode === 'cycle'
      ? 'Cycle non soldé'
      : 'Sans paiement récent';
  }

  get centralNotPaidReferenceMonthLabel(): string {
    const reference = this.getCentralNotPaidReferenceDate();
    return reference.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }

  get centralNotPaidSelectedTeamsLabel(): string {
    if (
      this.centralNotPaidSelectAllLocations ||
      this.centralNotPaidSelectedLocations.size === this.uniqueLocations.length
    ) {
      return 'Toutes les équipes';
    }
    if (this.centralNotPaidSelectedLocations.size === 0) {
      return 'Aucune équipe sélectionnée';
    }
    return `${this.centralNotPaidSelectedLocations.size} équipe(s)`;
  }

  get visibleCentralNotPaidResults(): Client[] {
    return this.showAllCentralNotPaidResults
      ? this.centralNotPaidResults
      : this.centralNotPaidResults.slice(0, 24);
  }

  get hasMoreCentralNotPaidResults(): boolean {
    return (
      this.centralNotPaidResults.length > this.visibleCentralNotPaidResults.length
    );
  }

  get centralNotPaidTotalDebtDollar(): number {
    return Number(
      this.compute.convertCongoleseFrancToUsDollars(
        this.centralNotPaidTotalDebt.toString()
      )
    );
  }

  get centralNotPaidAverageDebt(): number {
    return this.centralNotPaidResults.length === 0
      ? 0
      : this.centralNotPaidTotalDebt / this.centralNotPaidResults.length;
  }

  get centralNotPaidActiveThresholdDescription(): string {
    return this.centralNotPaidMode === 'cycle'
      ? `Cycle ouvert depuis au moins ${this.centralNotPaidActiveThreshold} mois`
      : `Aucun paiement dans les ${this.centralNotPaidActiveThreshold} derniers mois`;
  }

  setCentralNotPaidMode(mode: CentralNotPaidMode): void {
    if (this.centralNotPaidMode === mode) return;
    this.centralNotPaidMode = mode;
    this.applyCentralNotPaidFilters();
  }

  isCentralNotPaidMode(mode: CentralNotPaidMode): boolean {
    return this.centralNotPaidMode === mode;
  }

  centralNotPaidModeButtonClasses(mode: CentralNotPaidMode) {
    return {
      'bg-rose-600 text-white shadow-sm dark:bg-rose-500 dark:text-white':
        this.isCentralNotPaidMode(mode),
      'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700':
        !this.isCentralNotPaidMode(mode),
    };
  }

  onCentralNotPaidThresholdChange(value: string | number): void {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : 1;
    if (this.centralNotPaidMode === 'cycle') {
      this.centralNotPaidCycleMonthsThreshold = safeValue;
    } else {
      this.centralNotPaidNoPayMonthsThreshold = safeValue;
    }
    this.applyCentralNotPaidFilters();
  }

  onCentralNotPaidMonthChange(value: string): void {
    this.centralNotPaidMonth = value || this.currentMonthInputValue();
    this.applyCentralNotPaidFilters();
  }

  toggleCentralNotPaidIncludeQuitte(): void {
    this.centralNotPaidIncludeQuitte = !this.centralNotPaidIncludeQuitte;
    this.applyCentralNotPaidFilters();
  }

  toggleCentralNotPaidShowAllClients(): void {
    this.centralNotPaidShowAllClients = !this.centralNotPaidShowAllClients;
    this.applyCentralNotPaidFilters();
  }

  toggleCentralNotPaidAllLocations(): void {
    this.centralNotPaidSelectAllLocations = !this.centralNotPaidSelectAllLocations;
    this.resetCentralNotPaidLocationSelection(
      this.centralNotPaidSelectAllLocations
    );
    this.applyCentralNotPaidFilters();
  }

  toggleCentralNotPaidLocation(location: string): void {
    if (this.centralNotPaidSelectedLocations.has(location)) {
      this.centralNotPaidSelectedLocations.delete(location);
    } else {
      this.centralNotPaidSelectedLocations.add(location);
    }
    this.centralNotPaidSelectAllLocations =
      this.centralNotPaidSelectedLocations.size === this.uniqueLocations.length;
    this.applyCentralNotPaidFilters();
  }

  private setupCentralNotPaidSearch(): void {
    if (this.centralNotPaidSearchInitialized) return;
    this.centralNotPaidSearchInitialized = true;
    this.centralNotPaidSearchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((term) => {
        this.centralNotPaidSearchTerm = term ? String(term) : '';
        this.applyCentralNotPaidFilters();
      });
  }

  openCentralNotPaidStatusModal(client: Client): void {
    this.centralNotPaidStatusModal = {
      open: true,
      client,
      saving: false,
      error: '',
    };
  }

  closeCentralNotPaidStatusModal(): void {
    if (this.centralNotPaidStatusModal.saving) return;
    this.centralNotPaidStatusModal = {
      open: false,
      client: null,
      saving: false,
      error: '',
    };
  }

  async setCentralNotPaidClientStatus(status: 'quitte' | 'active'): Promise<void> {
    if (!this.auth.isAdmin || this.centralNotPaidStatusModal.saving) return;

    const client = this.centralNotPaidStatusModal.client;
    if (!client?.uid) {
      this.centralNotPaidStatusModal.error = 'Client introuvable.';
      return;
    }

    const ownerId = client.locationOwnerId;
    if (!ownerId) {
      this.centralNotPaidStatusModal.error =
        'Le site du client est introuvable. Mise à jour impossible.';
      return;
    }

    const vitalStatus = status === 'quitte' ? 'Quitté' : '';
    this.centralNotPaidStatusModal.saving = true;
    this.centralNotPaidStatusModal.error = '';

    try {
      await this.ensureCentralStatusAdminWriteAccess();
      await this.data.updateClientInvestigationFieldsForUser(ownerId, client.uid, {
        vitalStatus,
      });
      this.applyClientVitalStatusLocal(client.uid, ownerId, vitalStatus);
      this.refreshTomorrowBirthdayGroups();
      this.applyClientFilters();
      this.applyFinishedFilters();
      this.applyCentralNotPaidFilters();
      this.closeCentralNotPaidStatusModal();
    } catch (error) {
      console.error('Failed to update central not paid client status', error);
      this.centralNotPaidStatusModal.error =
        'Impossible de mettre à jour le statut du client.';
    } finally {
      this.centralNotPaidStatusModal.saving = false;
    }
  }

  private async ensureCentralStatusAdminWriteAccess(): Promise<void> {
    const roles = Array.isArray(this.auth.currentUser?.roles)
      ? this.auth.currentUser.roles
      : [];
    const hasPersistedAdmin =
      this.auth.currentUser?.admin === 'true' || roles.includes('admin');

    if (hasPersistedAdmin || !this.auth.isAdmninistrator) {
      return;
    }

    await this.auth.makeAdmin();
    this.auth.currentUser = {
      ...this.auth.currentUser,
      admin: 'true',
    };
  }

  private resetCentralNotPaidLocationSelection(all = true): void {
    this.centralNotPaidSelectedLocations.clear();
    if (all) {
      this.uniqueLocations.forEach((location) =>
        this.centralNotPaidSelectedLocations.add(location)
      );
      this.centralNotPaidSelectAllLocations = true;
    } else {
      this.centralNotPaidSelectAllLocations = false;
    }
  }

  private applyCentralNotPaidFilters(): void {
    const referenceDate = this.getCentralNotPaidReferenceDate();
    const term = this.centralNotPaidSearchTerm.trim().toLowerCase();

    const results = (this.allClients ?? [])
      .filter((client) => this.matchesCentralNotPaidLocation(client))
      .filter((client) => this.matchesCentralNotPaidSearch(client, term))
      .filter((client) =>
        this.centralNotPaidShowAllClients
          ? this.isCentralNotPaidAllModeClient(client)
          : this.isCentralNotPaidClient(client, referenceDate)
      )
      .sort((a, b) => {
        if (this.centralNotPaidShowAllClients) {
          const statusDiff = Number(this.isClientQuitte(b)) - Number(this.isClientQuitte(a));
          if (statusDiff !== 0) return statusDiff;

          const nameDiff = this.clientDisplayName(a).localeCompare(
            this.clientDisplayName(b)
          );
          if (nameDiff !== 0) return nameDiff;

          return (a.locationName || '').localeCompare(b.locationName || '');
        }

        const debtDiff = this.clientDebtLeftAmount(b) - this.clientDebtLeftAmount(a);
        if (debtDiff !== 0) return debtDiff;
        return this.clientDisplayName(a).localeCompare(this.clientDisplayName(b));
      });

    this.centralNotPaidResults = results;
    this.centralNotPaidTotalDebt = results.reduce(
      (sum, client) => sum + this.clientDebtLeftAmount(client),
      0
    );
    this.centralNotPaidGroups = this.buildCentralNotPaidGroups(results);
    this.showAllCentralNotPaidResults = false;
  }

  private isCentralNotPaidAllModeClient(client: Client): boolean {
    return this.normalizeVitalStatus(client.vitalStatus) !== 'mort';
  }

  private buildCentralNotPaidGroups(clients: Client[]): CentralNotPaidGroup[] {
    const grouped = new Map<string, Client[]>();
    clients.forEach((client) => {
      const location = client.locationName || 'Sans localisation';
      const list = grouped.get(location) || [];
      list.push(client);
      grouped.set(location, list);
    });

    return Array.from(grouped.entries())
      .map(([locationName, entries]) => ({
        key: locationName,
        locationName,
        clients: entries,
        totalDebt: entries.reduce(
          (sum, client) => sum + this.clientDebtLeftAmount(client),
          0
        ),
      }))
      .sort((a, b) => {
        const countDiff = b.clients.length - a.clients.length;
        return countDiff !== 0 ? countDiff : b.totalDebt - a.totalDebt;
      });
  }

  private isCentralNotPaidClient(client: Client, referenceDate: Date): boolean {
    if (this.clientDebtLeftAmount(client) <= 0) return false;
    if (!this.passesCentralNotPaidVitalStatus(client)) return false;

    const cycleStart = this.parseMonthDayYearDate(client.debtCycleStartDate);
    if (!cycleStart) return false;

    const ageMonths = this.monthsBetween(cycleStart, referenceDate);
    if (ageMonths < this.centralNotPaidActiveThreshold) return false;

    if (this.centralNotPaidMode === 'cycle') return true;

    return !this.hasRecentPaymentWithinMonths(
      client,
      referenceDate,
      this.centralNotPaidActiveThreshold
    );
  }

  private passesCentralNotPaidVitalStatus(client: Client): boolean {
    if (client.vitalStatus === 'Mort') return false;
    if (!this.centralNotPaidIncludeQuitte && client.vitalStatus === 'Quitté') {
      return false;
    }
    return true;
  }

  private matchesCentralNotPaidLocation(client: Client): boolean {
    if (
      this.centralNotPaidSelectAllLocations ||
      this.centralNotPaidSelectedLocations.size === 0
    ) {
      return true;
    }
    return this.centralNotPaidSelectedLocations.has(client.locationName || '');
  }

  private matchesCentralNotPaidSearch(client: Client, term: string): boolean {
    if (!term) return true;
    return [
      client.firstName,
      client.lastName,
      client.middleName,
      client.phoneNumber,
      client.locationName,
    ].some((field) => (field || '').toLowerCase().includes(term));
  }

  private hasRecentPaymentWithinMonths(
    client: Client,
    referenceDate: Date,
    months: number
  ): boolean {
    const payments = client.payments || {};
    const cutoff = new Date(referenceDate);
    cutoff.setMonth(cutoff.getMonth() - months);

    return Object.keys(payments).some((dateKey) => {
      const paymentDate = this.parseMonthDayYearDate(dateKey);
      if (!paymentDate) return false;
      return paymentDate >= cutoff && paymentDate <= referenceDate;
    });
  }

  private getCentralNotPaidReferenceDate(): Date {
    const [year, month] = (this.centralNotPaidMonth || this.currentMonthInputValue())
      .split('-')
      .map(Number);
    const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
    const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;
    return new Date(safeYear, safeMonth, 0, 23, 59, 59, 999);
  }

  private parseMonthDayYearDate(value?: string | null): Date | null {
    if (!value) return null;
    const [month, day, year] = value.split('-').map(Number);
    if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private monthsBetween(start: Date, end: Date): number {
    let months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months -= 1;
    return Math.max(0, months);
  }

  private clientDebtLeftAmount(client: Client): number {
    const raw = client.debtLeft ?? client.debtInProcess ?? 0;
    const amount = Number(String(raw).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(amount) ? amount : 0;
  }

  clientCentralNotPaidAgeMonths(client: Client): number {
    const start = this.parseMonthDayYearDate(client.debtCycleStartDate);
    if (!start) return 0;
    return this.monthsBetween(start, this.getCentralNotPaidReferenceDate());
  }

  clientCentralNotPaidLastPaymentLabel(client: Client): string {
    const dates = Object.keys(client.payments || {})
      .map((key) => this.parseMonthDayYearDate(key))
      .filter((date): date is Date => !!date)
      .sort((a, b) => b.getTime() - a.getTime());

    if (!dates.length) return 'Aucun paiement';
    return dates[0].toLocaleDateString('fr-FR');
  }

  private clientDisplayName(client: Client): string {
    return `${client.firstName || ''} ${client.lastName || ''} ${
      client.middleName || ''
    }`.trim();
  }

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
      this.birthdayTarget = this.createTomorrowBirthdayTarget();
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

  setActiveTopClientFocusPanel(panel: TopClientFocusPanel) {
    if (this.activeTopClientFocusPanel === panel) return;
    this.activeTopClientFocusPanel = panel;
  }

  isActiveTopClientFocusPanel(panel: TopClientFocusPanel) {
    return this.activeTopClientFocusPanel === panel;
  }

  topClientFocusButtonClasses(panel: TopClientFocusPanel) {
    return {
      'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-white':
        this.isActiveTopClientFocusPanel(panel),
      'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-300':
        !this.isActiveTopClientFocusPanel(panel),
    };
  }

  get activeTopClientFocusPanelTitle(): string {
    return 'Trophée non attribué';
  }

  get activeTopClientFocusPanelHint(): string {
    return 'Clients avec score de crédit ≥ 70 et aucune étoile, à revoir pour attribuer un trophée.';
  }

  setTrophyMissingFilter(mode: TrophyMissingFilterMode) {
    if (this.trophyMissingFilter === mode) {
      if (mode !== 'all') {
        this.trophyMissingFilter = 'all';
        this.applyClientFilters();
      }
      return;
    }

    this.trophyMissingFilter = mode;
    this.applyClientFilters();
  }

  isTrophyMissingFilter(mode: TrophyMissingFilterMode) {
    return this.trophyMissingFilter === mode;
  }

  trophyMissingButtonClasses(mode: TrophyMissingFilterMode) {
    return {
      'bg-emerald-500 text-white shadow-sm dark:bg-emerald-600 dark:text-white':
        this.isTrophyMissingFilter(mode),
      'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700':
        !this.isTrophyMissingFilter(mode),
    };
  }

  get trophyMissingClientsCount(): number {
    return (this.allClients ?? []).filter((client) =>
      this.isMissingTrophyClient(client)
    ).length;
  }

  get trophyMissingGroups(): TrophyMissingGroup[] {
    const grouped = new Map<string, Client[]>();

    for (const client of this.allClients ?? []) {
      if (!this.isMissingTrophyClient(client)) continue;
      const locationName = (client.locationName || 'Sans localisation').trim();
      const key = locationName || 'Sans localisation';
      const list = grouped.get(key) || [];
      list.push(client);
      grouped.set(key, list);
    }

    return Array.from(grouped.entries())
      .map(([locationName, clients]) => ({
        key: locationName,
        locationName,
        clients: clients
          .slice()
          .sort((a, b) =>
            `${a.firstName || ''} ${a.lastName || ''}`
              .trim()
              .localeCompare(`${b.firstName || ''} ${b.lastName || ''}`.trim())
          ),
      }))
      .sort((a, b) => {
        const countDiff = b.clients.length - a.clients.length;
        return countDiff !== 0
          ? countDiff
          : a.locationName.localeCompare(b.locationName);
      });
  }

  get trophyMissingLocationsCount(): number {
    return this.trophyMissingGroups.length;
  }

  trackTrophyMissingGroup(index: number, group: TrophyMissingGroup): string {
    return group.key;
  }

  trackTrophyMissingClient(index: number, client: Client): string {
    return (
      client.uid ||
      client.trackingId ||
      `${client.firstName || ''}-${client.lastName || ''}-${client.phoneNumber || index}`
    );
  }

  get tomorrowBirthdayDateLabel(): string {
    return this.formatBirthdayDateForDisplay(this.createTomorrowBirthdayTarget());
  }

  get tomorrowBirthdayTotalClients(): number {
    return this.tomorrowBirthdayGroups.reduce(
      (sum, group) => sum + group.clients.length,
      0
    );
  }

  get tomorrowBirthdayTotalRecipients(): number {
    return this.tomorrowBirthdayGroups.reduce(
      (sum, group) => sum + group.recipients.length,
      0
    );
  }

  get selectedBirthdayGroups(): BirthdayTomorrowGroup[] {
    if (this.birthdayFilterMode === 'all') {
      return this.buildBirthdayGroups(null);
    }

    if (!this.birthdayTarget) return [];

    if (this.selectedBirthdayIsTomorrow) {
      return this.tomorrowBirthdayGroups;
    }

    return this.buildBirthdayGroups(this.birthdayTarget);
  }

  get selectedBirthdayDateLabel(): string {
    if (this.birthdayFilterMode === 'all') return 'Toutes les dates';
    if (!this.birthdayTarget) return 'Date non choisie';
    return this.formatBirthdayDateForDisplay(this.birthdayTarget);
  }

  get selectedBirthdaySectionTitle(): string {
    switch (this.birthdayFilterMode) {
      case 'today':
        return "Anniversaires d'aujourd'hui";
      case 'tomorrow':
        return 'Anniversaires de demain';
      case 'custom':
        return 'Anniversaires choisis';
      default:
        return 'Tous les anniversaires';
    }
  }

  get selectedBirthdayTotalClients(): number {
    return this.selectedBirthdayGroups.reduce(
      (sum, group) => sum + group.clients.length,
      0
    );
  }

  get selectedBirthdayTotalRecipients(): number {
    return this.selectedBirthdayGroups.reduce(
      (sum, group) => sum + group.recipients.length,
      0
    );
  }

  get selectedBirthdayRecipients(): Client[] {
    return this.selectedBirthdayGroups.flatMap((group) => group.recipients);
  }

  get selectedBirthdayExcludedNoPhone(): number {
    return this.selectedBirthdayGroups.reduce(
      (sum, group) => sum + group.excludedNoPhone,
      0
    );
  }

  get selectedBirthdayEmptyMessage(): string {
    if (this.birthdayFilterMode === 'all') {
      return 'Aucun anniversaire enregistré.';
    }

    return 'Aucun anniversaire prévu pour cette date.';
  }

  get selectedBirthdayIsTomorrow(): boolean {
    if (!this.birthdayTarget) return false;
    const target = this.createTomorrowBirthdayTarget();
    return (
      this.birthdayTarget.month === target.month &&
      this.birthdayTarget.day === target.day
    );
  }

  get selectedBirthdayConditionSummary(): string {
    const parts = [
      `Anniversaire: ${this.selectedBirthdayDateLabel}`,
      `Clients: ${this.selectedBirthdayTotalClients}`,
      `Avec téléphone: ${this.selectedBirthdayTotalRecipients}`,
      `Sans téléphone: ${this.selectedBirthdayExcludedNoPhone}`,
    ];

    return this.joinConditionParts(parts);
  }

  trackTomorrowBirthdayGroup(index: number, group: BirthdayTomorrowGroup): string {
    return group.key;
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

  setActiveMasterFilterPanel(panel: MasterClientFilterPanel) {
    if (this.activeMasterFilterPanel === panel) return;
    this.activeMasterFilterPanel = panel;
  }

  isActiveMasterFilterPanel(panel: MasterClientFilterPanel) {
    return this.activeMasterFilterPanel === panel;
  }

  masterFilterPanelButtonClasses(panel: MasterClientFilterPanel) {
    return {
      'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-white':
        this.isActiveMasterFilterPanel(panel),
      'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-300':
        !this.isActiveMasterFilterPanel(panel),
    };
  }

  get activeMasterFilterPanelTitle(): string {
    switch (this.activeMasterFilterPanel) {
      case 'paymentDay':
        return 'Jour de paiement';
      case 'duplicatePhone':
        return 'Doublons téléphone';
      case 'audio':
        return 'Audio';
      case 'debtStatus':
        return 'Dette & Statut';
      case 'stars':
        return 'Étoiles';
      case 'scoreLoan':
        return 'Score & Prêt';
      case 'locations':
        return 'Sites (clients)';
      default:
        return 'Filtres';
    }
  }

  get activeMasterFilterPanelHint(): string {
    switch (this.activeMasterFilterPanel) {
      case 'paymentDay':
        return 'Affinez les clients selon leur jour de paiement prévu.';
      case 'duplicatePhone':
        return 'Repérez rapidement les numéros partagés entre plusieurs clients.';
      case 'audio':
        return "Filtrez les clients selon la présence d'un audio joint.";
      case 'debtStatus':
        return 'Combinez le statut de dette et le statut du client dans un seul panneau.';
      case 'stars':
        return 'Isolez les clients selon leurs étoiles ou un nombre exact.';
      case 'scoreLoan':
        return 'Réduisez la liste par score de crédit et montant de prêt.';
      case 'locations':
        return 'Activez seulement les sites clients que vous voulez voir.';
      default:
        return '';
    }
  }

  setDuplicatePhoneFilter(mode: 'all' | 'duplicates') {
    if (this.duplicatePhoneFilter === mode) return;
    this.duplicatePhoneFilter = mode;
    this.applyClientFilters();
  }

  isDuplicatePhoneFilter(mode: 'all' | 'duplicates') {
    return this.duplicatePhoneFilter === mode;
  }

  duplicatePhoneButtonClasses(mode: 'all' | 'duplicates') {
    return {
      'bg-emerald-500 text-white shadow-sm dark:bg-emerald-600 dark:text-white':
        this.isDuplicatePhoneFilter(mode),
      'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700':
        !this.isDuplicatePhoneFilter(mode),
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
    const hasTrophyMissingFilter = this.trophyMissingFilter !== 'all';
    const hasDuplicateFilter = this.duplicatePhoneFilter !== 'all';
    const hasAudioFilter = this.audioFilter !== 'all';

    const isDefaultView =
      !this.birthdayFilterSummary &&
      !hasSearch &&
      !hasScoreFilter &&
      !hasLoanFilter &&
      !hasDebtFilter &&
      !hasQuitteFilter &&
      !hasPaymentDayFilter &&
      !hasLocationFilter &&
      !hasTrophyMissingFilter &&
      !hasDuplicateFilter &&
      !hasAudioFilter;

    if (isDefaultView) {
      return `Tous les clients · ${baseTotal} client(s)`;
    }

    const parts: string[] = [];
    if (this.birthdayFilterSummary) {
      parts.push(this.birthdayFilterSummary);
    } else if (hasTrophyMissingFilter) {
      parts.push('Trophée non attribué');
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
    if (hasTrophyMissingFilter) {
      parts.push('Score ≥ 70 sans étoile');
    }
    if (hasLocationFilter) {
      parts.push(
        `${this.masterSelectedLocations.size} site(s)`
      );
    }
    if (hasDuplicateFilter) {
      parts.push('Doublons téléphone');
    }
    if (hasAudioFilter) {
      parts.push(
        this.audioFilter === 'withAudio' ? 'Avec audio' : 'Sans audio'
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
      .filter((client) => this.matchesStarsFilter(client))
      .filter((client) => this.matchesTrophyMissingFilter(client))
      .filter((client) => this.matchesDuplicatePhone(client))
      .filter((client) => this.matchesAudioFilter(client));

    this.filteredItems = base.filter((client) => this.matchesBirthdayFilter(client));
    this.filteredDebtTotal = this.calculateFilteredDebtTotal(this.filteredItems);
    this.updateSelectedPaymentDayTotal();
    if (this.generalBulkModal.open) this.updateGeneralBulkRecipients();
  }

  private normalizePhoneDigits(raw?: string | null): string {
    if (!raw) return '';
    return ('' + raw).replace(/\D/g, '');
  }

  private buildDuplicatePhoneIndex() {
    const counts = new Map<string, number>();
    const groups = new Map<string, Client[]>();
    for (const client of this.allClients ?? []) {
      const digits = this.normalizePhoneDigits(client.phoneNumber);
      if (!digits) continue;
      counts.set(digits, (counts.get(digits) || 0) + 1);
      const list = groups.get(digits) || [];
      list.push(client);
      groups.set(digits, list);
    }

    this.duplicatePhoneDigits = new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count >= 2)
        .map(([digits]) => digits)
    );
    this.duplicatePhoneCounts = Object.fromEntries(counts);
    this.duplicatePhoneGroupsCount = this.duplicatePhoneDigits.size;

    let dupClients = 0;
    for (const client of this.allClients ?? []) {
      const digits = this.normalizePhoneDigits(client.phoneNumber);
      if (digits && this.duplicatePhoneDigits.has(digits)) dupClients += 1;
    }
    this.duplicatePhoneClientsCount = dupClients;

    this.duplicatePhoneGroups = Array.from(this.duplicatePhoneDigits)
      .map((digits) => ({
        digits,
        clients: (groups.get(digits) || []).slice(),
      }))
      .sort((a, b) => {
        const lenDiff = b.clients.length - a.clients.length;
        return lenDiff !== 0 ? lenDiff : a.digits.localeCompare(b.digits);
      });
    this.duplicatePhoneGroups.forEach((group) => {
      group.clients.sort((a, b) => {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
        return nameA.localeCompare(nameB);
      });
    });
    this.duplicatePhoneGroupCollapsed = new Set(
      this.duplicatePhoneGroups.map((group) => group.digits)
    );
  }

  private matchesDuplicatePhone(client: Client): boolean {
    if (this.duplicatePhoneFilter !== 'duplicates') return true;
    const digits = this.normalizePhoneDigits(client.phoneNumber);
    return !!digits && this.duplicatePhoneDigits.has(digits);
  }
  private matchesAudioFilter(client: Client): boolean {
    switch (this.audioFilter) {
      case 'withAudio':
        return this.hasClientAuditAudio(client);
      case 'withoutAudio':
        return !this.hasClientAuditAudio(client);
      default:
        return true;
    }
  }
  setAudioFilter(mode: 'all' | 'withAudio' | 'withoutAudio') {
    if (this.audioFilter === mode) return;
    this.audioFilter = mode;
    this.applyClientFilters();
  }
  isAudioFilter(mode: 'all' | 'withAudio' | 'withoutAudio') {
    return this.audioFilter === mode;
  }

  isDuplicatePhoneClient(client: Client | null | undefined): boolean {
    if (!client) return false;
    const digits = this.normalizePhoneDigits(client.phoneNumber);
    return !!digits && this.duplicatePhoneDigits.has(digits);
  }

  getDuplicatePhoneCount(client: Client | null | undefined): number {
    if (!client) return 0;
    const digits = this.normalizePhoneDigits(client.phoneNumber);
    if (!digits) return 0;
    return this.duplicatePhoneCounts[digits] || 0;
  }

  openDuplicatePhoneModal() {
    if (!this.auth.isAdmin || this.duplicatePhoneFilter !== 'duplicates') return;
    this.duplicatePhoneUpdates = {};
    this.duplicatePhoneGroupUpdates = {};
    this.duplicatePhoneModal.open = true;
    this.duplicatePhoneModal.isSaving = false;
    this.duplicatePhoneModal.error = null;
    this.duplicatePhoneModal.result = null;
  }

  closeDuplicatePhoneModal() {
    this.duplicatePhoneModal.open = false;
    this.duplicatePhoneModal.isSaving = false;
    this.duplicatePhoneModal.error = null;
    this.duplicatePhoneModal.result = null;
  }

  setDuplicatePhoneUpdate(client: Client, value: string) {
    const key = this.clientKey(client);
    this.duplicatePhoneUpdates[key] = value;
  }

  getDuplicatePhoneUpdate(client: Client): string {
    const key = this.clientKey(client);
    return this.duplicatePhoneUpdates[key] || '';
  }

  setDuplicatePhoneGroupUpdate(groupDigits: string, value: string) {
    this.duplicatePhoneGroupUpdates[groupDigits] = value;
  }

  getDuplicatePhoneGroupUpdate(groupDigits: string): string {
    return this.duplicatePhoneGroupUpdates[groupDigits] || '';
  }

  isDuplicateGroupCollapsed(groupDigits: string): boolean {
    return this.duplicatePhoneGroupCollapsed.has(groupDigits);
  }

  toggleDuplicateGroupCollapsed(groupDigits: string) {
    if (this.duplicatePhoneGroupCollapsed.has(groupDigits)) {
      this.duplicatePhoneGroupCollapsed.delete(groupDigits);
    } else {
      this.duplicatePhoneGroupCollapsed.add(groupDigits);
    }
  }

  duplicateClientDebt(client: Client): number {
    const debt = this.parseDebtLeft(client.debtLeft ?? client.debtInProcess);
    return debt > 0 ? debt : 0;
  }

  private normalizeVitalStatus(value?: string | null): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private normalizeQuitteStatusFields(client?: Client | null): string {
    const rawClient = (client ?? {}) as any;
    const fields = [
      rawClient.vitalStatus,
      rawClient.vital_status,
      rawClient.status,
      rawClient.clientStatus,
      rawClient.followUpStatus,
      rawClient.suiviStatus,
      rawClient.state,
      rawClient.stage,
      rawClient.note,
      rawClient.notes,
      rawClient.flags,
      rawClient.tags,
      rawClient.labels,
    ];

    return this.normalizeVitalStatus(
      fields
        .filter(Boolean)
        .map((value) => {
          if (Array.isArray(value)) return value.join(' ');
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        })
        .join(' ')
    );
  }

  duplicateClientStatusLabel(client: Client): string {
    const raw = (client.vitalStatus || '').trim();
    const normalized = this.normalizeVitalStatus(raw);
    if (!normalized || normalized === 'vivant') return 'En cours';
    if (
      normalized === 'quitte' ||
      normalized === 'quittee' ||
      normalized === 'quite' ||
      normalized === 'quit'
    ) {
      return 'Quitté';
    }
    if (
      normalized === 'mort' ||
      normalized === 'decede' ||
      normalized === 'deceased' ||
      normalized === 'dead'
    ) {
      return 'Décédé';
    }
    return raw || 'À l’écart';
  }

  isDuplicateClientAway(client: Client): boolean {
    return this.duplicateClientStatusLabel(client) !== 'En cours';
  }

  duplicateGroupDebtTotal(group: { digits: string; clients: Client[] }): number {
    return (group?.clients || []).reduce(
      (sum, client) => sum + this.duplicateClientDebt(client),
      0
    );
  }

  duplicateGroupActiveDebtTotal(group: {
    digits: string;
    clients: Client[];
  }): number {
    return (group?.clients || []).reduce((sum, client) => {
      if (this.isDuplicateClientAway(client)) return sum;
      return sum + this.duplicateClientDebt(client);
    }, 0);
  }

  duplicateGroupAwayDebtTotal(group: { digits: string; clients: Client[] }): number {
    return (group?.clients || []).reduce((sum, client) => {
      if (!this.isDuplicateClientAway(client)) return sum;
      return sum + this.duplicateClientDebt(client);
    }, 0);
  }

  get duplicateModalDebtTotal(): number {
    return this.duplicatePhoneGroups.reduce(
      (sum, group) => sum + this.duplicateGroupDebtTotal(group),
      0
    );
  }

  get duplicateModalActiveDebtTotal(): number {
    return this.duplicatePhoneGroups.reduce(
      (sum, group) => sum + this.duplicateGroupActiveDebtTotal(group),
      0
    );
  }

  get duplicateModalAwayDebtTotal(): number {
    return this.duplicatePhoneGroups.reduce(
      (sum, group) => sum + this.duplicateGroupAwayDebtTotal(group),
      0
    );
  }

  applyDuplicateGroupValue(groupDigits: string) {
    const value = this.getDuplicatePhoneGroupUpdate(groupDigits).trim();
    if (!value) return;
    const group = this.duplicatePhoneGroups.find(
      (g) => g.digits === groupDigits
    );
    if (!group) return;
    group.clients.forEach((client) => {
      this.setDuplicatePhoneUpdate(client, value);
    });
  }

  private clientKey(client: Client): string {
    return (
      client.uid ||
      client.trackingId ||
      `${client.firstName || ''}-${client.lastName || ''}-${client.phoneNumber || ''}`
    );
  }

  private resolveDuplicatePhoneUpdate(
    client: Client,
    groupDigits: string
  ): string {
    const direct = this.getDuplicatePhoneUpdate(client).trim();
    if (direct) return direct;
    const groupValue = this.getDuplicatePhoneGroupUpdate(groupDigits).trim();
    return groupValue;
  }

  private normalizeForHistory(phone?: string | null): string {
    return this.normalizePhoneDigits(phone || '');
  }

  private async commitDuplicatePhoneUpdates(
    updates: Array<{ client: Client; newPhone: string }>,
    skipped: number
  ) {
    if (updates.length === 0) {
      this.duplicatePhoneModal.result = { updated: 0, skipped, failed: 0 };
      return;
    }

    const chunkSize = 400;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      const batch = this.afs.firestore.batch();
      const localUpdates: Array<{
        client: Client;
        newPhone: string;
        payload: Partial<Client>;
      }> = [];

      for (const item of chunk) {
        const client = item.client;
        const ownerId = client.locationOwnerId;
        if (!ownerId || !client.uid) {
          failed += 1;
          continue;
        }

        const prev = Array.isArray(client.previousPhoneNumbers)
          ? [...client.previousPhoneNumbers]
          : [];
        const currentRaw = (client.phoneNumber || '').toString();
        const oldNorm = this.normalizeForHistory(currentRaw);
        const newNorm = this.normalizeForHistory(item.newPhone);

        if (oldNorm && newNorm && oldNorm !== newNorm) {
          const alreadyInList = prev.some(
            (p) => this.normalizeForHistory(p) === oldNorm
          );
          if (!alreadyInList && currentRaw) prev.push(currentRaw);
        }

        const payload: Partial<Client> = {
          phoneNumber: item.newPhone,
          previousPhoneNumbers: prev,
        };
        const ref = this.afs.firestore.doc(
          `users/${ownerId}/clients/${client.uid}`
        );
        batch.set(ref, payload, { merge: true });
        localUpdates.push({
          client,
          newPhone: item.newPhone,
          payload,
        });
      }

      try {
        await batch.commit();
        for (const entry of localUpdates) {
          entry.client.phoneNumber = entry.newPhone;
          entry.client.previousPhoneNumbers = (entry.payload
            .previousPhoneNumbers || []) as string[];
          updated += 1;
        }
      } catch (error) {
        console.error('Duplicate phone bulk update failed', error);
        failed += localUpdates.length;
      }
    }

    this.buildDuplicatePhoneIndex();
    this.refreshTomorrowBirthdayGroups();
    this.applyClientFilters();
    this.duplicatePhoneModal.result = { updated, skipped, failed };
  }

  async applyDuplicatePhoneUpdates(groupDigits?: string) {
    if (this.duplicatePhoneModal.isSaving) return;
    this.duplicatePhoneModal.isSaving = true;
    this.duplicatePhoneModal.error = null;
    this.duplicatePhoneModal.result = null;

    const updates: Array<{ client: Client; newPhone: string }> = [];
    let skipped = 0;

    for (const group of this.duplicatePhoneGroups) {
      if (groupDigits && group.digits !== groupDigits) continue;
      for (const client of group.clients) {
        const raw = this.resolveDuplicatePhoneUpdate(client, group.digits).trim();
        if (!raw) continue;
        const newDigits = this.normalizePhoneDigits(raw);
        const oldDigits = this.normalizePhoneDigits(client.phoneNumber);
        if (!newDigits || newDigits === oldDigits) {
          skipped += 1;
          continue;
        }
        updates.push({ client, newPhone: raw });
      }
    }

    await this.commitDuplicatePhoneUpdates(updates, skipped);
    this.duplicatePhoneModal.isSaving = false;
  }

  async applyDuplicatePhoneUpdatesForGroup(groupDigits: string) {
    await this.applyDuplicatePhoneUpdates(groupDigits);
  }

  async applyDuplicatePhoneUpdateForClient(
    client: Client,
    groupDigits: string
  ) {
    if (this.duplicatePhoneModal.isSaving) return;
    this.duplicatePhoneModal.isSaving = true;
    this.duplicatePhoneModal.error = null;
    this.duplicatePhoneModal.result = null;

    const raw = this.resolveDuplicatePhoneUpdate(client, groupDigits).trim();
    if (!raw) {
      this.duplicatePhoneModal.result = { updated: 0, skipped: 1, failed: 0 };
      this.duplicatePhoneModal.isSaving = false;
      return;
    }
    const newDigits = this.normalizePhoneDigits(raw);
    const oldDigits = this.normalizePhoneDigits(client.phoneNumber);
    if (!newDigits || newDigits === oldDigits) {
      this.duplicatePhoneModal.result = { updated: 0, skipped: 1, failed: 0 };
      this.duplicatePhoneModal.isSaving = false;
      return;
    }

    await this.commitDuplicatePhoneUpdates([{ client, newPhone: raw }], 0);
    this.duplicatePhoneModal.isSaving = false;
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

  private isMissingTrophyClient(client: Client): boolean {
    const score = Number(client.creditScore);
    const expectedStars = this.expectedStarsForCreditScore(score);
    return expectedStars > 0 && this.getStarsCount(client) < expectedStars;
  }

  pendingStarsTarget(client: Client): number {
    return this.expectedStarsForCreditScore(Number(client.creditScore));
  }

  private expectedStarsForCreditScore(score: number): number {
    if (!Number.isFinite(score) || score < 70) return 0;
    if (score < 100) return 1;
    return 2 + Math.floor((score - 100) / 50);
  }

  private matchesTrophyMissingFilter(client: Client): boolean {
    if (this.trophyMissingFilter !== 'missing') return true;
    return this.isMissingTrophyClient(client);
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

  private refreshTomorrowBirthdayGroups(): void {
    const target = this.createTomorrowBirthdayTarget();
    this.tomorrowBirthdayGroups = this.buildBirthdayGroups(target);
    this.syncBirthdayTomorrowState();
  }

  private buildBirthdayGroups(
    target: { month: number; day: number } | null
  ): BirthdayTomorrowGroup[] {
    const grouped = new Map<string, Client[]>();

    for (const client of this.allClients ?? []) {
      if (target) {
        if (!this.hasBirthdayOnTarget(client, target)) continue;
      } else if (!client.birthDate) {
        continue;
      }

      const locationName = (client.locationName || 'Sans localisation').trim();
      const key = locationName || 'Sans localisation';
      const list = grouped.get(key) || [];
      list.push(client);
      grouped.set(key, list);
    }

    return Array.from(grouped.entries())
      .map(([locationName, clients]) => {
        const sortedClients = clients
          .slice()
          .sort((a, b) =>
            `${a.firstName || ''} ${a.lastName || ''}`
              .trim()
              .localeCompare(`${b.firstName || ''} ${b.lastName || ''}`.trim())
          );
        const recipients = sortedClients.filter((client) =>
          this.hasDialablePhone(client)
        );
        return {
          key: locationName,
          locationName,
          clients: sortedClients,
          recipients,
          excludedNoPhone: sortedClients.length - recipients.length,
        };
      })
      .sort(
        (a, b) =>
          b.clients.length - a.clients.length ||
          a.locationName.localeCompare(b.locationName)
      );
  }

  private syncBirthdayTomorrowState(): void {
    const validKeys = new Set(
      this.tomorrowBirthdayGroups.map((group) => group.key)
    );
    Object.keys(this.birthdayTomorrowResult).forEach((key) => {
      if (!validKeys.has(key)) delete this.birthdayTomorrowResult[key];
    });
    if (
      this.birthdayTomorrowModal.group &&
      !validKeys.has(this.birthdayTomorrowModal.group.key)
    ) {
      this.closeBirthdayTomorrowModal();
    }
  }

  private hasBirthdayOnTarget(
    client: Client,
    target: { month: number; day: number }
  ): boolean {
    const variants = this.extractMonthDayVariants(client.birthDate);
    if (variants.length === 0) return false;
    return variants.some(
      (entry) => entry.month === target.month && entry.day === target.day
    );
  }

  private matchesBirthdayFilter(client: Client): boolean {
    if (this.birthdayFilterMode === 'all') return true;

    if (!this.birthdayTarget) return false;

    return this.hasBirthdayOnTarget(client, this.birthdayTarget);
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

  private createTomorrowBirthdayTarget(): { month: number; day: number } {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.createTargetFromDate(tomorrow);
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
    const targetClients = this.scheduledReminderSendTargetClients;
    if (
      !this.allCurrentClientsWithDebtsScheduledToPayToday ||
      this.allCurrentClientsWithDebtsScheduledToPayToday.length === 0
    ) {
      console.log('No clients to remind.');
      return;
    }
    if (!targetClients.length) {
      alert(
        'Aucun client ne correspond à la règle actuelle du rappel collectif.'
      );
      return;
    }

    const reminderCount = targetClients.length;
    const todayLabel = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const confirmed = window.confirm(
      `Confirmer l'envoi du rappel d'aujourd'hui ?\n\n${reminderCount} client${
        reminderCount > 1 ? 's' : ''
      } planifié${
        reminderCount > 1 ? 's' : ''
      } pour le ${todayLabel} recevront un SMS de rappel.\n\nRègle active: ${
        this.scheduledReminderSendModeLabel
      }.\n\nCette action ne peut pas être annulée.`
    );

    if (!confirmed) return;

    const clientsPayload =
      targetClients.map((client) => {
        const minPayment = this.data.minimumPayment(client);
        return {
          firstName: client.firstName,
          lastName: client.lastName,
          phoneNumber: client.phoneNumber,
          isQuitte: this.isClientQuitte(client),
          vitalStatus: client.vitalStatus || null,
          minPayment,
          debtLeft: client.debtLeft,
          savings: client.savings,
        };
      });

    const callable = this.fns.httpsCallable('sendPaymentReminders');
    callable({
      clients: clientsPayload,
      sendMode: this.scheduledReminderSendMode,
      plannedTotal: this.scheduledReminderClientsToday.length,
      excludedQuitte: this.scheduledReminderExcludedQuitteCount,
    }).subscribe({
      next: (result: any) => {
        console.log('Reminder function result:', result);
        this.loadPaymentReminderLogsForDate();
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
    const max = Number(this.fdMaxScore);

    const base = this.finishedAll.filter((c) =>
      this.selectedLocations.has(c.locationName || '')
    );
    const withScore = base.filter((c) => {
      const score = Number(c.creditScore ?? 0);
      if (!Number.isFinite(score)) return false;
      if (!Number.isFinite(max)) return score >= min;
      return score >= min && score <= max;
    });
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

  onFdMinScoreChange(rawValue: number | string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      this.fdMinScore = 0;
    } else {
      const newMin = Math.max(Math.round(value), 0);
      this.fdMinScore = Math.min(newMin, this.fdMaxScore);
      if (this.fdMaxScore < this.fdMinScore) {
        this.fdMaxScore = this.fdMinScore;
      }
    }
    this.applyFinishedFilters();
  }

  onFdMaxScoreChange(rawValue: number | string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      this.fdMaxScore = 100;
    } else {
      const newMax = Math.max(Math.round(value), this.fdMinScore);
      this.fdMaxScore = newMax;
      if (this.fdMinScore > this.fdMaxScore) {
        this.fdMinScore = this.fdMaxScore;
      }
    }
    this.applyFinishedFilters();
  }

  private joinConditionParts(parts: string[]): string {
    const cleaned = parts.map((part) => part.trim()).filter(Boolean);
    return cleaned.length ? cleaned.join(' · ') : 'Aucune condition';
  }

  private formatScoreRange(min: number, max: number): string {
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : 100;
    if (safeMin <= 0 && safeMax >= 100) return 'Score: tous';
    if (safeMin <= 0) return `Score ≤ ${safeMax}`;
    if (safeMax >= 100) return `Score ≥ ${safeMin}`;
    if (safeMin === safeMax) return `Score = ${safeMin}`;
    return `Score ${safeMin}-${safeMax}`;
  }

  private buildFinishedConditionsSummary(): string {
    const parts: string[] = [];
    const min = Number(this.fdMinScore) || 0;
    const max = Number(this.fdMaxScore);
    parts.push(this.formatScoreRange(min, max));

    const search = String(this.fdSearchControl.value || '').trim();
    if (search) parts.push(`Recherche: "${search}"`);

    if (
      this.selectAllLocations ||
      this.selectedLocations.size === this.uniqueLocations.length
    ) {
      parts.push('Sites: tous');
    } else if (this.selectedLocations.size > 0) {
      parts.push(`Sites: ${Array.from(this.selectedLocations).join(', ')}`);
    }

    return this.joinConditionParts(parts);
  }

  private buildGeneralConditionsSummary(): string {
    const parts: string[] = [];
    const search = String(this.searchControl.value || '').trim();
    if (search) parts.push(`Recherche: "${search}"`);

    parts.push(this.formatScoreRange(this.minCreditScore, this.maxCreditScore));

    if (this.loanAmountFilterValue != null) {
      const label =
        this.loanAmountFilterMode === 'exact'
          ? `Montant = ${this.formatFc(this.loanAmountFilterValue)} FC`
          : `Montant ≥ ${this.formatFc(this.loanAmountFilterValue)} FC`;
      parts.push(label);
    }

    if (this.debtStatusFilter !== 'all') {
      parts.push(
        this.debtStatusFilter === 'withDebt'
          ? 'Dette: avec'
          : 'Dette: sans'
      );
    }

    if (this.quitteStatusFilter !== 'all') {
      parts.push(
        this.quitteStatusFilter === 'quitte'
          ? 'Statut: quitté'
          : 'Statut: actif'
      );
    }

    if (this.starsFilter !== 'all') {
      if (this.starsFilter === 'noStars') parts.push('Étoiles: aucune');
      else if (this.starsFilter === 'withStars') parts.push('Étoiles: avec');
      else if (this.starsFilter === 'exact' && this.starsFilterValue != null) {
        parts.push(`Étoiles = ${this.starsFilterValue}`);
      }
    }

    if (this.trophyMissingFilter === 'missing') {
      parts.push('Trophée: non attribué');
    }

    if (this.birthdayFilterMode !== 'all') {
      if (this.birthdayFilterMode === 'today')
        parts.push("Anniversaire: aujourd'hui");
      else if (this.birthdayFilterMode === 'tomorrow')
        parts.push('Anniversaire: demain');
      else if (this.birthdayFilterMode === 'custom' && this.customBirthdayInput) {
        parts.push(`Anniversaire: ${this.customBirthdayInput}`);
      }
    }

    if (this.selectedPaymentDay) {
      parts.push(`Paiement: ${this.displayPaymentDay(this.selectedPaymentDay)}`);
    }

    if (
      this.masterSelectAllLocations ||
      this.masterSelectedLocations.size === this.uniqueLocations.length
    ) {
      parts.push('Sites: tous');
    } else if (this.masterSelectedLocations.size > 0) {
      parts.push(
        `Sites: ${Array.from(this.masterSelectedLocations).join(', ')}`
      );
    }

    return this.joinConditionParts(parts);
  }

  private buildContactConditionsSummary(): string {
    const parts: string[] = [];
    const search = this.contactSearchTerm.trim();
    if (search) parts.push(`Recherche: "${search}"`);

    if (this.contactSelectedOwnerKeys.size > 0) {
      const labels = this.contactAvailableLocations
        .filter((opt) => this.contactSelectedOwnerKeys.has(opt.value))
        .map((opt) => opt.label);
      if (labels.length) parts.push(`Sites: ${labels.join(', ')}`);
    } else {
      parts.push('Sites: tous');
    }

    return this.joinConditionParts(parts);
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

  private birthdayTomorrowTemplate(): string {
    return `Fondation gervais etombeli yo
Mbotama Elamu {{FULL_NAME}}. Nzambe apambola misala na yo.`;
  }

  private birthdayBulkTemplate(): string {
    return `{fullName},
Mbotama elamu!
Na mokolo oyo ya esengo, Fondation Gervais ezali kotombela yo Mbotama elamu pe mapamboli na nionso ozali kosala. 
Tosepeli kozala elongo na yo.
Fondation Gervais`;
  }

  openBirthdayBulkModal(): void {
    const recipients = this.selectedBirthdayRecipients;
    if (!recipients.length) return;

    this.birthdayBulkModal.open = true;
    this.birthdayBulkModal.message = this.birthdayBulkTemplate();
    this.birthdayBulkModal.recipients = recipients;
    this.birthdayBulkModal.excludedNoPhone = this.selectedBirthdayExcludedNoPhone;
    this.birthdayBulkModal.result = null;
    this.birthdayBulkSending = false;
  }

  closeBirthdayBulkModal(): void {
    this.birthdayBulkModal.open = false;
    this.birthdayBulkModal.message = '';
    this.birthdayBulkModal.recipients = [];
    this.birthdayBulkModal.excludedNoPhone = 0;
    this.birthdayBulkModal.result = null;
    this.birthdayBulkSending = false;
  }

  get birthdayBulkPreview(): string {
    const first = this.birthdayBulkModal.recipients[0];
    if (!first) return '—';
    return this.personalizeBirthdayMessage(
      first,
      this.birthdayBulkModal.message
    );
  }

  private clientFullName(client: Client): string {
    return `${client.firstName ?? ''} ${client.lastName ?? ''}`
      .trim()
      .replace(/\s+/g, ' ');
  }

  private personalizeBirthdayMessage(client: Client, template: string): string {
    const fullName = this.clientFullName(client) || 'client';
    return template
      .replace(/\{\s*fullName\s*\}/gi, fullName)
      .replace(/\{\{\s*FULL_NAME\s*\}\}/g, fullName);
  }

  async sendBirthdayBulkMessagesFromModal(): Promise<void> {
    const template = this.birthdayBulkModal.message?.trim() || '';
    const recipients = [...this.birthdayBulkModal.recipients];
    if (!template || !recipients.length) return;

    this.birthdayBulkSending = true;
    this.birthdayBulkModal.result = null;

    const failures: BulkFailure[] = [];
    let succeeded = 0;

    for (const client of recipients) {
      try {
        const phoneNumber = client.phoneNumber!;
        const message = this.personalizeBirthdayMessage(client, template);
        await this.messaging.sendCustomSMS(phoneNumber, message, {
          reason: 'birthday_bulk',
          clientId: client.trackingId || client.uid || null,
          clientName: this.clientFullName(client),
          locationName: client.locationName || null,
          birthdayDate: this.selectedBirthdayDateLabel,
        });
        succeeded += 1;
      } catch (error: any) {
        console.error('Birthday bulk SMS failed', error);
        failures.push({
          client,
          error: error?.message || "Échec d'envoi",
        });
      }
    }

    const total = recipients.length;
    this.birthdayBulkModal.result = {
      total,
      succeeded,
      failed: failures.length,
      failures,
    };
    this.birthdayBulkSending = false;

    await this.logBulkMessage('birthdays', {
      total,
      succeeded,
      failed: failures.length,
      locationTotals: this.aggregateLocations(
        recipients,
        (client) => client.locationName
      ),
      template,
      messagePreview: this.personalizeBirthdayMessage(recipients[0], template),
      conditionSummary: this.selectedBirthdayConditionSummary,
    });
  }

  get birthdayAutomationStatusLabel(): string {
    return this.birthdayAutomationEnabled ? 'Activé' : 'Désactivé';
  }

  get birthdayAutomationStatusHint(): string {
    return this.birthdayAutomationEnabled
      ? `Chaque jour à ${this.birthdayAutomationSendTime} Kinshasa, les clients dont l’anniversaire est ce jour recevront le message.`
      : 'Aucun message anniversaire ne sera envoyé automatiquement.';
  }

  birthdayAutomationDebtModeLabel(mode: BirthdayAutomationDebtMode): string {
    switch (mode) {
      case 'withDebt':
        return 'Avec dette';
      case 'withoutDebt':
        return 'Sans dette';
      default:
        return 'Tous';
    }
  }

  birthdayAutomationStatusModeLabel(mode: BirthdayAutomationStatusMode): string {
    switch (mode) {
      case 'excludeQuitte':
        return 'Non quittés';
      case 'onlyQuitte':
        return 'Quittés';
      default:
        return 'Tous';
    }
  }

  birthdayAutomationModeButtonClasses(active: boolean) {
    return {
      'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-white':
        active,
      'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-300':
        !active,
    };
  }

  async setBirthdayAutomationEnabled(enabled: boolean): Promise<void> {
    if (this.birthdayAutomationEnabled === enabled) return;
    await this.saveBirthdayAutomationSettings({ enabled });
  }

  async setBirthdayAutomationDebtMode(
    debtMode: BirthdayAutomationDebtMode
  ): Promise<void> {
    if (this.birthdayAutomationDebtMode === debtMode) return;
    await this.saveBirthdayAutomationSettings({ debtMode });
  }

  async setBirthdayAutomationStatusMode(
    statusMode: BirthdayAutomationStatusMode
  ): Promise<void> {
    if (this.birthdayAutomationStatusMode === statusMode) return;
    await this.saveBirthdayAutomationSettings({ statusMode });
  }

  async onBirthdayAutomationSendTimeChange(event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement)?.value || '';
    if (!this.isValidBirthdayAutomationSendTime(value)) return;
    if (this.birthdayAutomationSendTime === value) return;
    await this.saveBirthdayAutomationSettings({ sendTime: value });
  }

  private isValidBirthdayAutomationSendTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private async saveBirthdayAutomationSettings(update: {
    enabled?: boolean;
    sendTime?: string;
    debtMode?: BirthdayAutomationDebtMode;
    statusMode?: BirthdayAutomationStatusMode;
  }): Promise<void> {
    this.birthdayAutomationSettingsSaving = true;
    this.birthdayAutomationSettingsError = null;

    const nextEnabled = update.enabled ?? this.birthdayAutomationEnabled;
    const nextSendTime =
      update.sendTime && this.isValidBirthdayAutomationSendTime(update.sendTime)
        ? update.sendTime
        : this.birthdayAutomationSendTime;
    const nextDebtMode = update.debtMode ?? this.birthdayAutomationDebtMode;
    const nextStatusMode =
      update.statusMode ?? this.birthdayAutomationStatusMode;

    try {
      await this.afs.doc('birthday_automation_settings/default').set(
        {
          enabled: nextEnabled,
          sendTimeLocal: nextSendTime,
          debtMode: nextDebtMode,
          statusMode: nextStatusMode,
          timeZone: 'Africa/Kinshasa',
          template: this.birthdayBulkTemplate(),
          updatedAtMs: Date.now(),
          updatedBy: this.auth.currentUser?.uid ?? null,
        },
        { merge: true }
      );
      this.birthdayAutomationEnabled = nextEnabled;
      this.birthdayAutomationSendTime = nextSendTime;
      this.birthdayAutomationDebtMode = nextDebtMode;
      this.birthdayAutomationStatusMode = nextStatusMode;
    } catch (error) {
      console.error('Birthday automation settings save failed', error);
      this.birthdayAutomationSettingsError =
        'Impossible de sauvegarder la préparation automatique.';
    } finally {
      this.birthdayAutomationSettingsSaving = false;
    }
  }

  private async loadBirthdayAutomationSettings(): Promise<void> {
    this.birthdayAutomationSettingsLoading = true;
    this.birthdayAutomationSettingsError = null;

    try {
      const snap: any = await firstValueFrom(
        this.afs.doc('birthday_automation_settings/default').get()
      );
      const data = snap?.data?.() || {};
      this.birthdayAutomationEnabled = data.enabled === true;
      this.birthdayAutomationSendTime = this.isValidBirthdayAutomationSendTime(
        data.sendTimeLocal
      )
        ? data.sendTimeLocal
        : '09:00';
      this.birthdayAutomationDebtMode =
        data.debtMode === 'withDebt' || data.debtMode === 'withoutDebt'
          ? data.debtMode
          : 'all';
      this.birthdayAutomationStatusMode =
        data.statusMode === 'all' || data.statusMode === 'onlyQuitte'
          ? data.statusMode
          : 'excludeQuitte';
    } catch (error) {
      console.error('Birthday automation settings load failed', error);
      this.birthdayAutomationSettingsError =
        'Impossible de charger la préparation automatique.';
      this.birthdayAutomationEnabled = false;
      this.birthdayAutomationSendTime = '09:00';
      this.birthdayAutomationDebtMode = 'all';
      this.birthdayAutomationStatusMode = 'excludeQuitte';
    } finally {
      this.birthdayAutomationSettingsLoading = false;
    }
  }

  openBirthdayTomorrowModal(group: BirthdayTomorrowGroup): void {
    this.birthdayTomorrowModal.open = true;
    this.birthdayTomorrowModal.group = group;
    this.birthdayTomorrowModal.message = this.birthdayTomorrowTemplate();
    this.birthdayTomorrowModal.scheduleAt = '';
    this.birthdayTomorrowModal.result = null;
    this.birthdayTomorrowModalSending = false;
    this.birthdayTomorrowModalScheduling = false;
  }

  closeBirthdayTomorrowModal(): void {
    this.birthdayTomorrowModal.open = false;
    this.birthdayTomorrowModal.group = null;
    this.birthdayTomorrowModal.message = '';
    this.birthdayTomorrowModal.scheduleAt = '';
    this.birthdayTomorrowModal.result = null;
    this.birthdayTomorrowModalSending = false;
    this.birthdayTomorrowModalScheduling = false;
  }

  get birthdayTomorrowPreview(): string {
    const group = this.birthdayTomorrowModal.group;
    if (!group || !group.recipients.length) return '—';
    return this.personalizeBirthdayTomorrowMessage(
      group.recipients[0],
      this.birthdayTomorrowModal.message
    );
  }

  private personalizeBirthdayTomorrowMessage(
    client: Client,
    template: string
  ): string {
    return this.personalizeBirthdayMessage(client, template);
  }

  private buildBirthdayTomorrowConditionsSummary(
    group: BirthdayTomorrowGroup
  ): string {
    return this.joinConditionParts([
      'Anniversaire: demain',
      `Site: ${group.locationName}`,
      `Clients: ${group.clients.length}`,
      `Sans téléphone: ${group.excludedNoPhone}`,
    ]);
  }

  async sendBirthdayTomorrowMessagesFromModal(): Promise<void> {
    const group = this.birthdayTomorrowModal.group;
    const template = this.birthdayTomorrowModal.message?.trim() || '';
    if (!group || !group.recipients.length || !template) return;

    this.birthdayTomorrowModalSending = true;
    this.birthdayTomorrowModal.result = null;
    this.birthdayTomorrowResult[group.key] = null;

    const failures: BulkFailure[] = [];
    let succeeded = 0;

    try {
      for (const client of group.recipients) {
        try {
          await this.messaging.sendCustomSMS(
            client.phoneNumber!,
            this.personalizeBirthdayTomorrowMessage(client, template),
            {
              reason: 'birthday_tomorrow_bulk',
              clientId: client.trackingId || client.uid || null,
              clientName: `${client.firstName} ${client.lastName}`.trim(),
              locationName: client.locationName || null,
            }
          );
          succeeded += 1;
        } catch (error: any) {
          console.error('Tomorrow birthday SMS failed', error);
          failures.push({
            client,
            error: error?.message || "Échec d'envoi",
          });
        }
      }

      const total = group.recipients.length;
      const failed = failures.length;
      const status: SendResult = {
        ok: failed === 0,
        text:
          failed === 0
            ? `SMS anniversaire envoyés (${succeeded}/${total}).`
            : `SMS anniversaire envoyés ${succeeded}/${total}, échecs ${failed}.`,
      };
      this.birthdayTomorrowModal.result = status;
      this.birthdayTomorrowResult[group.key] = status;

      await this.logBulkMessage('birthday_tomorrow', {
        total,
        succeeded,
        failed,
        locationTotals: this.aggregateLocations(
          group.recipients,
          (client) => client.locationName
        ),
        template,
        messagePreview: this.personalizeBirthdayTomorrowMessage(
          group.recipients[0],
          template
        ),
        conditionSummary: this.buildBirthdayTomorrowConditionsSummary(group),
      });
    } finally {
      this.birthdayTomorrowModalSending = false;
    }
  }

  async scheduleBirthdayTomorrowMessagesFromModal(): Promise<void> {
    const group = this.birthdayTomorrowModal.group;
    const template = this.birthdayTomorrowModal.message?.trim() || '';
    const scheduleAt = this.birthdayTomorrowModal.scheduleAt?.trim() || '';
    if (!group || !group.recipients.length || !template || !scheduleAt) return;

    this.birthdayTomorrowModalScheduling = true;
    this.birthdayTomorrowModal.result = null;
    this.birthdayTomorrowResult[group.key] = null;

    try {
      const recipients = group.recipients.map((client) => ({
        phoneNumber: client.phoneNumber!,
        message: this.personalizeBirthdayTomorrowMessage(client, template),
      }));

      await this.createScheduledBulkMessage({
        type: 'birthday_tomorrow',
        scheduledForLocal: scheduleAt,
        recipients,
        template,
        messagePreview: this.personalizeBirthdayTomorrowMessage(
          group.recipients[0],
          template
        ),
        locationTotals: this.aggregateLocations(
          group.recipients,
          (client) => client.locationName
        ),
        conditionSummary: this.buildBirthdayTomorrowConditionsSummary(group),
      });

      const status: SendResult = {
        ok: true,
        text: 'SMS anniversaire programmés.',
      };
      this.birthdayTomorrowModal.result = status;
      this.birthdayTomorrowResult[group.key] = status;
    } catch (error) {
      console.error('Schedule tomorrow birthday SMS failed', error);
      const status: SendResult = {
        ok: false,
        text: 'Échec de la programmation.',
      };
      this.birthdayTomorrowModal.result = status;
      this.birthdayTomorrowResult[group.key] = status;
    } finally {
      this.birthdayTomorrowModalScheduling = false;
    }
  }

  // ====== bulk modal & actions ======
  openBulkModal() {
    this.bulkModal.open = true;
    this.bulkModal.result = null;
    this.bulkModal.minScore = this.fdMinScore;
    this.bulkModal.scheduleAt = '';
    this.bulkScheduleResult = null;
    this.applyDefaultBulkTemplate();
    this.updateBulkRecipients();
  }
  closeBulkModal() {
    this.bulkModal.open = false;
    this.bulkModal.message = '';
    this.bulkModal.recipients = [];
    this.bulkModal.result = null;
    this.bulkModal.scheduleAt = '';
    this.bulkScheduleResult = null;
    this.bulkSending = false;
    this.bulkScheduling = false;
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
    const recipients = [...this.bulkModal.recipients];

    for (const c of recipients) {
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

    const locationTotals = this.aggregateLocations(
      recipients,
      (client) => client.locationName
    );
    await this.logBulkMessage('finished_clients', {
      total,
      succeeded,
      failed: failures.length,
      locationTotals,
      template: this.bulkModal.message,
      messagePreview: this.previewPersonalized(),
      conditionSummary: this.buildFinishedConditionsSummary(),
    });
  }

  async scheduleBulkSms() {
    if (
      !this.bulkModal.message?.trim() ||
      this.bulkModal.recipients.length === 0 ||
      !this.bulkModal.scheduleAt?.trim()
    )
      return;

    this.bulkScheduling = true;
    this.bulkScheduleResult = null;

    try {
      const recipients = this.bulkModal.recipients.map((c) => ({
        phoneNumber: c.phoneNumber!,
        message: this.personalizeMessage(this.bulkModal.message, c),
      }));
      const locationTotals = this.aggregateLocations(
        this.bulkModal.recipients,
        (client) => client.locationName
      );
      await this.createScheduledBulkMessage({
        type: 'finished_clients',
        scheduledForLocal: this.bulkModal.scheduleAt,
        recipients,
        template: this.bulkModal.message,
        messagePreview: this.previewPersonalized(),
        locationTotals,
        conditionSummary: this.buildFinishedConditionsSummary(),
      });
      this.bulkScheduleResult = {
        ok: true,
        text: 'Envoi groupé programmé.',
      };
    } catch (error) {
      console.error('Schedule bulk SMS failed', error);
      this.bulkScheduleResult = {
        ok: false,
        text: 'Échec de la programmation.',
      };
    } finally {
      this.bulkScheduling = false;
    }
  }

  // ===== general custom bulk (master list) =====
  get generalEligibleCount(): number {
    return this.filteredItems.filter((c) => this.hasDialablePhone(c)).length;
  }

  openGeneralBulkModal() {
    this.generalBulkModal.open = true;
    this.generalBulkModal.result = null;
    this.generalBulkModal.scheduleAt = '';
    this.generalBulkScheduleResult = null;
    this.applyGeneralDefaultTemplate();
    this.updateGeneralBulkRecipients();
  }

  closeGeneralBulkModal() {
    this.generalBulkModal.open = false;
    this.generalBulkModal.message = '';
    this.generalBulkModal.recipients = [];
    this.generalBulkModal.result = null;
    this.generalBulkSending = false;
    this.generalBulkModal.scheduleAt = '';
    this.generalBulkScheduleResult = null;
    this.generalBulkScheduling = false;
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
    const recipients = [...this.generalBulkModal.recipients];

    for (const c of recipients) {
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

    const locationTotals = this.aggregateLocations(
      recipients,
      (client) => client.locationName
    );
    await this.logBulkMessage('general_filters', {
      total,
      succeeded,
      failed: failures.length,
      locationTotals,
      template: this.generalBulkModal.message,
      messagePreview: this.generalPreviewPersonalized(),
      conditionSummary: this.buildGeneralConditionsSummary(),
    });
  }

  async scheduleGeneralBulkSms() {
    if (
      !this.generalBulkModal.message?.trim() ||
      this.generalBulkModal.recipients.length === 0 ||
      !this.generalBulkModal.scheduleAt?.trim()
    )
      return;

    this.generalBulkScheduling = true;
    this.generalBulkScheduleResult = null;

    try {
      const recipients = this.generalBulkModal.recipients.map((c) => ({
        phoneNumber: c.phoneNumber!,
        message: this.personalizeMessage(this.generalBulkModal.message, c),
      }));
      const locationTotals = this.aggregateLocations(
        this.generalBulkModal.recipients,
        (client) => client.locationName
      );
      await this.createScheduledBulkMessage({
        type: 'general_filters',
        scheduledForLocal: this.generalBulkModal.scheduleAt,
        recipients,
        template: this.generalBulkModal.message,
        messagePreview: this.generalPreviewPersonalized(),
        locationTotals,
        conditionSummary: this.buildGeneralConditionsSummary(),
      });
      this.generalBulkScheduleResult = {
        ok: true,
        text: 'Envoi groupé programmé.',
      };
    } catch (error) {
      console.error('Schedule general bulk SMS failed', error);
      this.generalBulkScheduleResult = {
        ok: false,
        text: 'Échec de la programmation.',
      };
    } finally {
      this.generalBulkScheduling = false;
    }
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
  openClientModal(client: Client) {
    this.activeClient = client;
    this.phoneEditValue = client.phoneNumber ?? '';
    this.phoneEditOpen = false;
    this.phoneEditSaving = false;
    this.showPhoneHistory = false;
    this.showRecentPaymentsExpanded = false;
    this.showRecentSavingsExpanded = false;
    this.showClientCommentsExpanded = false;
    this.showClientAuditAudioSectionExpanded = false;
    this.showClientAuditAudiosExpanded = false;
    this.showActiveClientHomePicture = false;
    this.selectedActiveClientGalleryPicture = undefined;
    this.showClientModal = true;
  }
  closeClientModal() {
    this.showClientModal = false;
    this.activeClient = null;
    this.showActiveClientHomePicture = false;
    this.selectedActiveClientGalleryPicture = undefined;
    this.phoneEditOpen = false;
    this.phoneEditSaving = false;
    this.showPhoneHistory = false;
    this.showRecentPaymentsExpanded = false;
    this.showRecentSavingsExpanded = false;
    this.showClientCommentsExpanded = false;
    this.showClientAuditAudioSectionExpanded = false;
    this.showClientAuditAudiosExpanded = false;
  }
  openActiveClientPortal() {
    const trackingId = this.activeClient?.trackingId;
    if (!trackingId) return;
    this.closeClientModal();
    this.router.navigate(['/client-portal', trackingId]);
  }
  private formatFc(n: number | string): string {
    return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  }
  formatAmount(value?: string | number | null): string {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  }
  displayPhone(value?: string | null): string {
    return this.formatDisplayPhone(value) || 'numero indisponible';
  }
  clientInitials(client?: Client | null): string {
    const first = (client?.firstName ?? '').trim();
    const last = (client?.lastName ?? '').trim();
    const initials = `${first[0] || ''}${last[0] || ''}`.trim();
    return (initials || 'CL').toUpperCase();
  }
  clientProfilePictureUrl(client?: Client | null): string {
    const picture = client?.profilePicture as
      | { downloadURL?: string }
      | string
      | undefined;
    if (!picture) return '';
    return typeof picture === 'string' ? picture : picture.downloadURL || '';
  }
  clientHomePictureUrl(client?: Client | null): string {
    const picture = client?.homePicture as
      | { downloadURL?: string }
      | string
      | undefined;
    if (!picture) return '';
    return typeof picture === 'string' ? picture : picture.downloadURL || '';
  }
  openActiveClientHomePicture(): void {
    if (!this.clientHomePictureUrl(this.activeClient)) return;
    const picture = this.clientModalGalleryPictures(this.activeClient)[0];
    if (picture) {
      this.selectedActiveClientGalleryPicture = picture;
    }
  }
  closeActiveClientHomePicture(): void {
    this.showActiveClientHomePicture = false;
    this.selectedActiveClientGalleryPicture = undefined;
  }
  clientModalGalleryPictures(client?: Client | null): ClientGalleryPicture[] {
    const pictures: ClientGalleryPicture[] = [];
    const seenUrls = new Set<string>();
    const homeUrl = this.clientHomePictureUrl(client);

    if (homeUrl) {
      pictures.push({
        id: '__home-picture',
        category: 'domicile',
        mediaType: 'image',
        mimeType: 'image/*',
        url: homeUrl,
        path: 'clients-home/domicile-verification',
        size: 0,
        name: 'Photo maison',
        uploadedAt: client?.dateOfRequest
          ? this.toGalleryDate(client.dateOfRequest)
          : new Date(0).toISOString(),
      });
      seenUrls.add(homeUrl);
    }

    Object.entries(client?.galleryPictures ?? {}).forEach(([id, picture]) => {
      const url = picture?.url?.trim();
      if (!url || seenUrls.has(url) || this.isGalleryVideo(picture)) {
        return;
      }
      pictures.push({
        ...picture,
        id: picture.id || id,
        mediaType: 'image',
        uploadedAt: picture.uploadedAt || new Date(0).toISOString(),
      });
      seenUrls.add(url);
    });

    return pictures.sort(
      (a, b) => this.galleryPictureDateValue(b) - this.galleryPictureDateValue(a)
    );
  }
  hasMoreClientModalGalleryPictures(client?: Client | null): boolean {
    return this.clientModalGalleryPictures(client).length > 6;
  }
  openClientModalGalleryPicture(picture: ClientGalleryPicture): void {
    this.selectedActiveClientGalleryPicture = picture;
  }
  closeClientModalGalleryPicture(): void {
    this.selectedActiveClientGalleryPicture = undefined;
  }
  get selectedClientModalGalleryPictureIndex(): number {
    if (!this.selectedActiveClientGalleryPicture) {
      return -1;
    }
    return this.clientModalGalleryPictures(this.activeClient).findIndex(
      (picture) =>
        picture.id === this.selectedActiveClientGalleryPicture?.id ||
        picture.url === this.selectedActiveClientGalleryPicture?.url
    );
  }
  get canNavigateClientModalGalleryPicture(): boolean {
    return this.clientModalGalleryPictures(this.activeClient).length > 1;
  }
  get selectedClientModalGalleryPicturePosition(): string {
    const pictures = this.clientModalGalleryPictures(this.activeClient);
    const index = this.selectedClientModalGalleryPictureIndex;
    if (index < 0 || !pictures.length) {
      return '';
    }
    return `${index + 1} / ${pictures.length}`;
  }
  showPreviousClientModalGalleryPicture(): void {
    this.showAdjacentClientModalGalleryPicture(-1);
  }
  showNextClientModalGalleryPicture(): void {
    this.showAdjacentClientModalGalleryPicture(1);
  }
  private showAdjacentClientModalGalleryPicture(direction: -1 | 1): void {
    const pictures = this.clientModalGalleryPictures(this.activeClient);
    if (!this.selectedActiveClientGalleryPicture || pictures.length <= 1) {
      return;
    }
    const currentIndex = this.selectedClientModalGalleryPictureIndex;
    const normalizedIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex =
      (normalizedIndex + direction + pictures.length) % pictures.length;
    this.selectedActiveClientGalleryPicture = pictures[nextIndex];
  }
  private isGalleryVideo(picture?: Partial<ClientGalleryPicture>): boolean {
    if (picture?.mediaType === 'video') {
      return true;
    }
    const mimeType = picture?.mimeType?.toLowerCase() || '';
    if (mimeType.startsWith('video/')) {
      return true;
    }
    const source = `${picture?.path || ''} ${picture?.name || ''} ${
      picture?.url || ''
    }`.toLowerCase();
    return /\.(mp4|mov|m4v|webm|ogg)(\?|$|\s)/.test(source);
  }
  private toGalleryDate(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? new Date(0).toISOString()
      : parsed.toISOString();
  }
  private galleryPictureDateValue(picture: Partial<ClientGalleryPicture>): number {
    const parsed = new Date(picture.uploadedAt || '').getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  isClientQuitte(client?: Client | null): boolean {
    const normalized = this.normalizeQuitteStatusFields(client);
    return (
      normalized === 'quitte' ||
      normalized === 'quittee' ||
      normalized === 'quite' ||
      normalized === 'quit' ||
      /\b\+?quittee?\b|\bleft\b|\bparti(e)?\b/.test(normalized)
    );
  }
  get allActivePhones(): string[] {
    const raw = [
      this.activeClient?.phoneNumber || '',
      ...(this.activeClient?.previousPhoneNumbers || []),
    ].filter(Boolean);

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const phone of raw) {
      const normalized = this.normalizePhoneDigits(phone);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      unique.push(phone);
    }
    return unique;
  }
  startPhoneEdit() {
    if (!this.auth.isAdmin || !this.activeClient) return;
    this.phoneEditValue = this.activeClient.phoneNumber ?? '';
    this.phoneEditOpen = !this.phoneEditOpen;
  }
  togglePhoneHistory() {
    if (this.allActivePhones.length <= 1) return;
    this.showPhoneHistory = !this.showPhoneHistory;
  }
  async updateClientPhoneNumber() {
    if (!this.auth.isAdmin || !this.activeClient?.uid) return;

    const newPhone = this.phoneEditValue.trim();
    const currentPhone = (this.activeClient.phoneNumber ?? '').trim();
    const ownerId = this.activeClient.locationOwnerId;

    if (!newPhone) {
      alert('Veuillez saisir un numéro de téléphone.');
      return;
    }

    if (newPhone === currentPhone) {
      alert('Aucun changement détecté.');
      return;
    }

    if (!ownerId) {
      alert('Le site du client est introuvable. Mise à jour impossible.');
      return;
    }

    const previousPhoneNumbers = this.buildPreviousPhoneNumbers(
      this.activeClient.previousPhoneNumbers,
      currentPhone,
      newPhone
    );

    const shouldContinue = confirm(
      `Confirmer la mise à jour du numéro ?\nAncien: ${
        currentPhone || 'indisponible'
      }\nNouveau: ${newPhone}`
    );
    if (!shouldContinue) return;

    this.phoneEditSaving = true;
    try {
      await this.data.updateClientInvestigationFieldsForUser(ownerId, this.activeClient.uid, {
        phoneNumber: newPhone,
        previousPhoneNumbers,
      });
      this.applyClientPhoneNumberLocal(
        this.activeClient.uid,
        ownerId,
        newPhone,
        previousPhoneNumbers
      );
      this.phoneEditValue = newPhone;
      this.buildDuplicatePhoneIndex();
      this.refreshTomorrowBirthdayGroups();
      this.applyClientFilters();
      this.applyFinishedFilters();
    } catch (error) {
      console.error('Failed to update client phone number', error);
      alert('Impossible de mettre à jour le numéro.');
    } finally {
      this.phoneEditSaving = false;
    }
  }
  recentClientPayments(
    client?: Client | null
  ): Array<{ key: string; amount: number; label: string }> {
    const payments = client?.payments || {};
    const entries = Object.entries(payments)
      .map(([key, value]) => ({
        key,
        amount: Number(value ?? 0),
        label: this.formatClientPaymentDate(key),
      }))
      .filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0);

    entries.sort(
      (a, b) => this.paymentKeyToTimestamp(b.key) - this.paymentKeyToTimestamp(a.key)
    );
    return entries;
  }
  visibleRecentPayments(
    client?: Client | null
  ): Array<{ key: string; amount: number; label: string }> {
    const all = this.recentClientPayments(client);
    return this.showRecentPaymentsExpanded ? all : all.slice(0, 3);
  }
  hasMoreRecentPayments(client?: Client | null): boolean {
    return this.recentClientPayments(client).length > 3;
  }
  toggleRecentPayments() {
    this.showRecentPaymentsExpanded = !this.showRecentPaymentsExpanded;
  }
  recentClientSavings(
    client?: Client | null
  ): Array<{ key: string; amount: number; label: string }> {
    const savings = client?.savingsPayments || {};
    const entries = Object.entries(savings)
      .map(([key, value]) => ({
        key,
        amount: Number(value ?? 0),
        label: this.formatClientPaymentDate(key),
      }))
      .filter((entry) => Number.isFinite(entry.amount) && entry.amount !== 0);

    entries.sort(
      (a, b) => this.paymentKeyToTimestamp(b.key) - this.paymentKeyToTimestamp(a.key)
    );
    return entries;
  }
  visibleRecentSavings(
    client?: Client | null
  ): Array<{ key: string; amount: number; label: string }> {
    const all = this.recentClientSavings(client);
    return this.showRecentSavingsExpanded ? all : all.slice(0, 3);
  }
  hasMoreRecentSavings(client?: Client | null): boolean {
    return this.recentClientSavings(client).length > 3;
  }
  toggleRecentSavings() {
    this.showRecentSavingsExpanded = !this.showRecentSavingsExpanded;
  }
  clientReferences(client?: Client | null): Array<{
    name: string;
    phone: string;
    tel: string;
    raw: string;
  }> {
    const refs = Array.isArray(client?.references) ? client?.references ?? [] : [];
    return refs
      .map((entry) => this.parseReferenceEntry(entry))
      .filter((entry) => entry.name || entry.phone || entry.raw);
  }
  getClientComments(client?: Client | null): Comment[] {
    const comments = Array.isArray(client?.comments) ? client?.comments ?? [] : [];
    return [...comments].sort((a, b) => {
      const dateA = this.paymentKeyToTimestamp(a?.time || '');
      const dateB = this.paymentKeyToTimestamp(b?.time || '');
      return dateB - dateA;
    });
  }
  visibleClientComments(client?: Client | null): Comment[] {
    const comments = this.getClientComments(client);
    return this.showClientCommentsExpanded ? comments : comments.slice(0, 3);
  }
  hasMoreClientComments(client?: Client | null): boolean {
    return this.getClientComments(client).length > 3;
  }
  toggleClientComments() {
    this.showClientCommentsExpanded = !this.showClientCommentsExpanded;
  }
  clientAuditConversationAudios(
    client?: Client | null
  ): AuditConversationAudioAttachment[] {
    if (client?.auditConversationAudios !== undefined) {
      return client.auditConversationAudios;
    }

    if (!client?.auditConversationAudioUrl) {
      return [];
    }

    return [
      {
        url: client.auditConversationAudioUrl,
        name: client.auditConversationAudioName,
        mimeType: client.auditConversationAudioMimeType,
        recordedAt: client.auditConversationAudioRecordedAt,
        recordedAtSource: client.auditConversationAudioRecordedAtSource,
        uploadedAt: client.auditConversationAudioUploadedAt,
        uploadedBy: client.auditConversationAudioUploadedBy,
      },
    ];
  }
  hasClientAuditAudio(client?: Client | null): boolean {
    return this.clientAuditConversationAudios(client).length > 0;
  }
  clientAuditAudioCount(client?: Client | null): number {
    return this.clientAuditConversationAudios(client).length;
  }
  toggleClientAuditAudioList(client?: Client | null) {
    const key = this.clientAudioKey(client);
    if (!key) return;
    if (this.expandedClientAudioKeys.has(key)) {
      this.expandedClientAudioKeys.delete(key);
      return;
    }
    this.expandedClientAudioKeys.add(key);
  }
  isClientAuditAudioListExpanded(client?: Client | null): boolean {
    const key = this.clientAudioKey(client);
    return !!key && this.expandedClientAudioKeys.has(key);
  }
  toggleActiveClientAuditAudios() {
    if (this.clientAuditAudioCount(this.activeClient) <= 1) return;
    this.showClientAuditAudiosExpanded = !this.showClientAuditAudiosExpanded;
  }
  toggleClientAuditAudioSection() {
    this.showClientAuditAudioSectionExpanded =
      !this.showClientAuditAudioSectionExpanded;
  }
  visibleClientAuditAudios(
    client?: Client | null
  ): AuditConversationAudioAttachment[] {
    const audios = this.clientAuditConversationAudios(client);
    return this.showClientAuditAudiosExpanded ? audios : audios.slice(0, 1);
  }
  hasMoreClientAuditAudios(client?: Client | null): boolean {
    return this.clientAuditConversationAudios(client).length > 1;
  }
  clientAuditAudioTitle(
    audio: AuditConversationAudioAttachment,
    index: number
  ): string {
    return audio.name?.trim() || `Audio ${index + 1}`;
  }
  clientAuditAudioSubtitle(audio: AuditConversationAudioAttachment): string {
    const parts: string[] = [];
    if (audio.uploadedBy) parts.push(audio.uploadedBy);
    if (audio.uploadedAt) {
      parts.push(this.time.convertDateToDesiredFormat(audio.uploadedAt));
    }
    return parts.join(' · ');
  }
  commentPreview(comment?: Comment | null): string {
    const text = (comment?.comment ?? '').trim();
    if (text) return text;
    if (comment?.audioUrl) return 'Audio joint';
    if (Array.isArray(comment?.attachments) && comment!.attachments!.length > 0) {
      return 'Média joint';
    }
    return 'Commentaire vide';
  }
  commentTime(comment?: Comment | null): string {
    if (comment?.timeFormatted) return comment.timeFormatted;
    if (!comment?.time) return '-';
    return this.time.convertDateToDesiredFormat(comment.time);
  }
  formatDebtDate(value?: string | null): string {
    const raw = (value ?? '').trim();
    if (!raw) return '-';
    if (raw.includes('/')) return raw;
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }
    const parts = raw.split('-');
    if (parts.length >= 3) {
      const [month, day, year] = parts;
      if (month && day && year) return `${day}/${month}/${year}`;
    }
    return raw;
  }
  clientDebtCycleStartLabel(client?: Client | null): string {
    return this.formatDebtCycleDisplayDate(client?.debtCycleStartDate);
  }
  clientDebtCycleEndLabel(client?: Client | null): string {
    const computedEnd = this.computeClientDebtCycleEndDate(client);
    if (computedEnd) return this.formatDebtCycleDateObject(computedEnd);
    return this.formatDebtCycleDisplayDate(client?.debtCycleEndDate);
  }
  isClientDebtOverdue(client?: Client | null): boolean {
    if (!client || this.clientDebtLeftAmount(client) <= 0) return false;
    const endDate =
      this.computeClientDebtCycleEndDate(client) ||
      this.parseDebtCycleDate(client.debtCycleEndDate);
    if (!endDate) return false;
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    return new Date() > endOfDay;
  }
  private computeClientDebtCycleEndDate(client?: Client | null): Date | null {
    const start = this.parseDebtCycleDate(client?.debtCycleStartDate);
    if (!start) return null;
    const end = new Date(start);
    end.setDate(
      end.getDate() + (Number(client?.paymentPeriodRange) === 8 ? 56 : 28)
    );
    return end;
  }
  private formatDebtCycleDisplayDate(value?: string | null): string {
    const date = this.parseDebtCycleDate(value);
    if (!date) return this.formatDebtDate(value);
    return this.formatDebtCycleDateObject(date);
  }
  private formatDebtCycleDateObject(date: Date): string {
    const month = this.time.monthFrenchNames[date.getMonth()] ?? '';
    return `${date.getDate()} ${month} ${date.getFullYear()}`.trim();
  }
  private parseDebtCycleDate(value?: string | null): Date | null {
    const raw = (value ?? '').toString().trim();
    if (!raw) return null;

    let day: number | undefined;
    let month: number | undefined;
    let year: number | undefined;
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      year = Number(isoMatch[1]);
      month = Number(isoMatch[2]);
      day = Number(isoMatch[3]);
    } else if (raw.includes('/')) {
      [day, month, year] = raw.split('/').map((part) => Number(part));
    } else {
      [month, day, year] = raw.split('-').map((part) => Number(part));
    }

    if (
      !Number.isFinite(day) ||
      !Number.isFinite(month) ||
      !Number.isFinite(year)
    ) {
      return null;
    }

    const date = new Date(year!, month! - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  fcToUsdDisplay(value: number | string | null | undefined): string {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num) || num <= 0) return '0';
    const usdRaw = Number(
      this.compute.convertCongoleseFrancToUsDollars(num.toString())
    );
    if (!Number.isFinite(usdRaw) || usdRaw <= 0) return '0';
    return usdRaw.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  private clientAudioKey(client?: Client | null): string {
    return (
      client?.uid ||
      client?.trackingId ||
      `${client?.firstName || ''}-${client?.lastName || ''}-${client?.phoneNumber || ''}`
    );
  }
  private applyClientPhoneNumberLocal(
    clientId: string,
    ownerId: string,
    phoneNumber: string,
    previousPhoneNumbers: string[]
  ) {
    const updateList = (list?: Client[] | null) => {
      (list || []).forEach((client) => {
        if (client.uid !== clientId) return;
        if (client.locationOwnerId && client.locationOwnerId !== ownerId) return;
        client.phoneNumber = phoneNumber;
        client.previousPhoneNumbers = [...previousPhoneNumbers];
      });
    };

    updateList(this.allClients);
    updateList(this.filteredItems);
    updateList(this.finishedAll);
    updateList(this.finishedFiltered);
    updateList(this.allcurrentClientsWithDebts);
    updateList(this.allCurrentClients ?? []);
    updateList(this.allCurrentClientsWithDebtsScheduledToPayToday);

    if (this.activeClient?.uid === clientId) {
      this.activeClient.phoneNumber = phoneNumber;
      this.activeClient.previousPhoneNumbers = [...previousPhoneNumbers];
    }
  }
  private applyClientVitalStatusLocal(
    clientId: string,
    ownerId: string,
    vitalStatus: string
  ) {
    const updateList = (list?: Client[] | null) => {
      (list || []).forEach((client) => {
        if (client.uid !== clientId) return;
        if (client.locationOwnerId && client.locationOwnerId !== ownerId) return;
        client.vitalStatus = vitalStatus;
      });
    };

    updateList(this.allClients);
    updateList(this.filteredItems);
    updateList(this.finishedAll);
    updateList(this.finishedFiltered);
    updateList(this.allcurrentClientsWithDebts);
    updateList(this.allCurrentClients ?? []);
    updateList(this.allCurrentClientsWithDebtsScheduledToPayToday);
    updateList(this.centralNotPaidResults);
    this.centralNotPaidGroups.forEach((group) => updateList(group.clients));

    if (this.activeClient?.uid === clientId) {
      this.activeClient.vitalStatus = vitalStatus;
    }

    if (this.centralNotPaidStatusModal.client?.uid === clientId) {
      this.centralNotPaidStatusModal.client.vitalStatus = vitalStatus;
    }
  }
  private buildPreviousPhoneNumbers(
    existing: string[] | undefined,
    oldPhone: string,
    newPhone: string
  ): string[] {
    const oldNorm = this.normalizePhoneDigits(oldPhone);
    const newNorm = this.normalizePhoneDigits(newPhone);
    const list = Array.isArray(existing) ? [...existing] : [];

    if (!oldNorm || !newNorm || oldNorm === newNorm) {
      return list;
    }

    const alreadyInList = list.some(
      (phone) => this.normalizePhoneDigits(phone) === oldNorm
    );
    if (!alreadyInList && oldPhone) {
      list.push(oldPhone);
    }

    return list;
  }
  private parseReferenceEntry(entry: unknown): {
    name: string;
    phone: string;
    tel: string;
    raw: string;
  } {
    const raw = (entry ?? '').toString().trim();
    if (!raw) {
      return { name: '', phone: '', tel: '', raw: '' };
    }

    const parts = raw.split(' - ');
    const name = (parts[0] || '').trim();
    const phone = (parts.slice(1).join(' - ') || '').trim();
    const tel = phone.replace(/[^\d+]/g, '');

    return {
      name: name || raw,
      phone,
      tel,
      raw,
    };
  }
  private formatClientPaymentDate(key: string): string {
    const parts = key.split('-');
    if (parts.length >= 6) {
      return this.time.convertTimeFormat(key);
    }
    if (parts.length >= 3) {
      return this.time.convertDateToDayMonthYear(parts.slice(0, 3).join('-'));
    }
    return key;
  }
  private paymentKeyToTimestamp(key: string): number {
    const parts = key.split('-').map((value) => Number(value));
    if (
      parts.length >= 6 &&
      parts.slice(0, 6).every((value) => Number.isFinite(value))
    ) {
      const [month, day, year, hour, minute, second] = parts;
      return new Date(year, month - 1, day, hour, minute, second).getTime();
    }
    if (
      parts.length >= 3 &&
      parts.slice(0, 3).every((value) => Number.isFinite(value))
    ) {
      const [month, day, year] = parts;
      return new Date(year, month - 1, day).getTime();
    }
    const fallback = new Date(key).getTime();
    return Number.isNaN(fallback) ? 0 : fallback;
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
  showAllFilteredContacts = false;

  // Contact bulk SMS modal
  contactBulkModal = {
    open: false,
    message: '' as string,
    recipients: [] as ContactEntry[],
    excludedNoPhone: 0,
    result: null as BulkResult | null,
    scheduleAt: '' as string,
  };
  contactBulkSending = false;
  contactBulkScheduling = false;
  contactBulkScheduleResult: SendResult | null = null;

  bulkLogs: BulkMessageLog[] = [];
  bulkLogsLoading = false;
  bulkLogsError: string | null = null;
  showAllBulkLogs = false;

  private bulkLogsSub?: Subscription;
  private birthdayHistorySub?: Subscription;
  scheduledBulkMessages: ScheduledBulkMessage[] = [];
  scheduledBulkLoading = false;
  scheduledBulkError: string | null = null;
  showAllScheduledBulk = false;
  private scheduledBulkSub?: Subscription;
  paymentReminderLogs: PaymentReminderLog[] = [];
  paymentReminderLogsLoading = false;
  paymentReminderLogsError: string | null = null;
  paymentReminderLogsWarning: string | null = null;
  paymentReminderDateKey = this.formatDateKeyForTimeZone(
    new Date(),
    'Africa/Kinshasa'
  );
  private readonly paymentReminderLogsLimit = 20;


  ngOnDestroy(): void {
    this.contactsSub?.unsubscribe();
    this.bulkLogsSub?.unsubscribe();
    this.birthdayHistorySub?.unsubscribe();
    this.scheduledBulkSub?.unsubscribe();
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
    this.contactBulkModal.scheduleAt = '';
    this.contactBulkScheduleResult = null;
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
    this.contactBulkModal.scheduleAt = '';
    this.contactBulkScheduleResult = null;
    this.contactBulkScheduling = false;
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
    const recipients = [...this.contactBulkModal.recipients];

    for (const contact of recipients) {
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

    const locationTotals = this.aggregateLocations(
      recipients,
      (contact) => contact.ownerName
    );
    await this.logBulkMessage('prospect_contacts', {
      total,
      succeeded,
      failed: failures.length,
      locationTotals,
      template: this.contactBulkModal.message,
      messagePreview: this.contactBulkPreviewMessage,
      conditionSummary: this.buildContactConditionsSummary(),
    });
  }

  async scheduleContactBulkMessages(): Promise<void> {
    if (
      !this.contactBulkModal.message?.trim() ||
      this.contactBulkModal.recipients.length === 0 ||
      !this.contactBulkModal.scheduleAt?.trim()
    )
      return;

    this.contactBulkScheduling = true;
    this.contactBulkScheduleResult = null;

    try {
      const recipients = this.contactBulkModal.recipients.map((contact) => ({
        phoneNumber: contact.phoneNumber,
        message: this.personalizeContactMessage(
          this.contactBulkModal.message,
          contact
        ),
      }));
      const locationTotals = this.aggregateLocations(
        this.contactBulkModal.recipients,
        (contact) => contact.ownerName
      );
      await this.createScheduledBulkMessage({
        type: 'prospect_contacts',
        scheduledForLocal: this.contactBulkModal.scheduleAt,
        recipients,
        template: this.contactBulkModal.message,
        messagePreview: this.contactBulkPreviewMessage,
        locationTotals,
        conditionSummary: this.buildContactConditionsSummary(),
      });
      this.contactBulkScheduleResult = {
        ok: true,
        text: 'Envoi groupé programmé.',
      };
    } catch (error) {
      console.error('Schedule contact bulk SMS failed', error);
      this.contactBulkScheduleResult = {
        ok: false,
        text: 'Échec de la programmation.',
      };
    } finally {
      this.contactBulkScheduling = false;
    }
  }

  get contactEligibleCount(): number {
    return this.filteredContacts.filter((c) =>
      this.hasDialableContactPhone(c)
    ).length;
  }

  get visibleFilteredItems(): Client[] {
    return this.showAllFilteredItems
      ? this.filteredItems
      : this.filteredItems.slice(0, 8);
  }

  get hasMoreFilteredItems(): boolean {
    return this.filteredItems.length > 8;
  }

  toggleFilteredItemsExpansion(): void {
    if (!this.hasMoreFilteredItems) return;
    this.showAllFilteredItems = !this.showAllFilteredItems;
  }

  get visibleFinishedFiltered(): Client[] {
    return this.showAllFinishedFiltered
      ? this.finishedFiltered
      : this.finishedFiltered.slice(0, 10);
  }

  get hasMoreFinishedFiltered(): boolean {
    return this.finishedFiltered.length > 10;
  }

  toggleFinishedFilteredExpansion(): void {
    if (!this.hasMoreFinishedFiltered) return;
    this.showAllFinishedFiltered = !this.showAllFinishedFiltered;
  }

  get visibleFilteredContacts(): ContactEntry[] {
    return this.showAllFilteredContacts
      ? this.filteredContacts
      : this.filteredContacts.slice(0, 10);
  }

  get hasMoreFilteredContacts(): boolean {
    return this.filteredContacts.length > 10;
  }

  toggleFilteredContactsExpansion(): void {
    if (!this.hasMoreFilteredContacts) return;
    this.showAllFilteredContacts = !this.showAllFilteredContacts;
  }

  get visibleBulkLogs(): BulkMessageLog[] {
    if (this.showAllBulkLogs) {
      return this.bulkLogs;
    }
    return this.bulkLogs.slice(0, 2);
  }

  get hasMoreBulkLogs(): boolean {
    return this.bulkLogs.length > 2;
  }

  toggleBulkLogExpansion(): void {
    if (!this.hasMoreBulkLogs) return;
    this.showAllBulkLogs = !this.showAllBulkLogs;
  }

  get birthdayHistoryMonthLabel(): string {
    const [year, month] = this.birthdayHistoryMonth.split('-').map(Number);
    if (!year || !month) return this.birthdayHistoryMonth;
    return new Date(year, month - 1, 1, 12).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }

  get birthdayHistoryMonthSummary(): {
    total: number;
    succeeded: number;
    failed: number;
  } {
    return this.birthdayHistoryLogs.reduce(
      (summary, log) => {
        summary.total += Number(log.total) || 0;
        summary.succeeded += Number(log.succeeded) || 0;
        summary.failed += Number(log.failed) || 0;
        return summary;
      },
      { total: 0, succeeded: 0, failed: 0 }
    );
  }

  onBirthdayHistoryMonthChange(event: Event): void {
    const value =
      (event.target as HTMLInputElement | null)?.value?.trim() || '';
    if (!/^\d{4}-\d{2}$/.test(value) || value === this.birthdayHistoryMonth) {
      return;
    }

    this.birthdayHistoryMonth = value;
    this.listenToBirthdayHistoryLogsForMonth();
  }

  get visibleScheduledBulkMessages(): ScheduledBulkMessage[] {
    if (this.showAllScheduledBulk) {
      return this.scheduledBulkMessages;
    }
    return this.scheduledBulkMessages.slice(0, 2);
  }

  get hasMoreScheduledBulkMessages(): boolean {
    return this.scheduledBulkMessages.length > 2;
  }

  toggleScheduledBulkExpansion(): void {
    if (!this.hasMoreScheduledBulkMessages) return;
    this.showAllScheduledBulk = !this.showAllScheduledBulk;
  }

  trackBulkLog(index: number, log: BulkMessageLog): string {
    return log.id;
  }

  trackBirthdayHistoryLog(index: number, log: BulkMessageLog): string {
    return log.id;
  }

  private listenToBulkLogs(): void {
    this.bulkLogsLoading = true;
    this.bulkLogsError = null;
    this.bulkLogsSub?.unsubscribe();

    this.bulkLogsSub = this.afs
      .collection<BulkMessageLogDocument>('bulk_message_logs', (ref) =>
        ref.orderBy('sentAtMs', 'desc').limit(30)
      )
      .snapshotChanges()
      .subscribe({
        next: (snaps) => {
          this.bulkLogs = snaps.map((snap) =>
            this.transformBulkLogDocument(
              snap.payload.doc.id,
              snap.payload.doc.data()
            )
          );
          this.bulkLogsLoading = false;
        },
        error: (error) => {
          console.error('Bulk log listener error', error);
          this.bulkLogsError = "Impossible de charger l'historique.";
          this.bulkLogsLoading = false;
        },
      });
  }

  private listenToBirthdayHistoryLogsForMonth(): void {
    this.birthdayHistoryLoading = true;
    this.birthdayHistoryError = null;
    this.birthdayHistoryWarning = null;
    this.birthdayHistorySub?.unsubscribe();

    const { startMs, endMs } = this.birthdayHistoryQueryRange(
      this.birthdayHistoryMonth
    );
    const limit = 300;

    this.birthdayHistorySub = this.afs
      .collection<BulkMessageLogDocument>('bulk_message_logs', (ref) =>
        ref
          .where('sentAtMs', '>=', startMs)
          .where('sentAtMs', '<', endMs)
          .orderBy('sentAtMs', 'desc')
          .limit(limit)
      )
      .snapshotChanges()
      .subscribe({
        next: (snaps) => {
          this.birthdayHistoryLogs = snaps
            .map((snap) =>
              this.transformBulkLogDocument(
                snap.payload.doc.id,
                snap.payload.doc.data()
              )
            )
            .filter(
              (log) =>
                this.isBirthdayHistoryLog(log) &&
                this.formatMonthKeyForTimeZone(
                  log.sentAtDate,
                  'Africa/Kinshasa'
                ) === this.birthdayHistoryMonth
            );

          this.birthdayHistoryWarning =
            snaps.length >= limit
              ? 'Historique limité aux 300 derniers envois du mois.'
              : null;
          this.birthdayHistoryLoading = false;
        },
        error: (error) => {
          console.error('Birthday history listener error', error);
          this.birthdayHistoryError =
            "Impossible de charger l'historique des anniversaires.";
          this.birthdayHistoryLoading = false;
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
          this.scheduledBulkMessages = snaps.map((snap) =>
            this.transformScheduledBulkDocument(
              snap.payload.doc.id,
              snap.payload.doc.data()
            )
          );
          this.scheduledBulkLoading = false;
        },
        error: (error) => {
          console.error('Scheduled bulk listener error', error);
          this.scheduledBulkError = 'Impossible de charger les programmations.';
          this.scheduledBulkLoading = false;
        },
      });
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

  get paymentReminderSummaryStats(): PaymentReminderSummaryStats {
    return this.paymentReminderLogs.reduce(
      (summary, log) => {
        const plannedTotal = Number(log.plannedTotal) || Number(log.total) || 0;
        const excludedQuitte = Number(log.excludedQuitte) || 0;
        summary.runs += 1;
        summary.planned += plannedTotal;
        summary.sent += Number(log.succeeded) || 0;
        summary.failed += Number(log.failed) || 0;
        summary.skipped += Number(log.skipped) || 0;
        summary.quittePlanned += (Number(log.quitteTotal) || 0) + excludedQuitte;
        summary.quitteSent += Number(log.quitteSucceeded) || 0;
        return summary;
      },
      {
        runs: 0,
        planned: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        quittePlanned: 0,
        quitteSent: 0,
      }
    );
  }

  get paymentReminderDateLabel(): string {
    const date = this.dateFromDateKey(this.paymentReminderDateKey);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  get paymentReminderIsToday(): boolean {
    return (
      this.paymentReminderDateKey ===
      this.formatDateKeyForTimeZone(new Date(), 'Africa/Kinshasa')
    );
  }

  get hasPaymentReminderLogs(): boolean {
    return this.paymentReminderLogs.length > 0;
  }

  paymentReminderMetric(value: number): string {
    if (!this.hasPaymentReminderLogs) return '—';
    return Number(value || 0).toLocaleString('fr-FR', {
      maximumFractionDigits: 0,
    });
  }

  get scheduledReminderClientsToday(): Client[] {
    return this.allCurrentClientsWithDebtsScheduledToPayToday ?? [];
  }

  get scheduledReminderSendTargetClients(): Client[] {
    if (this.scheduledReminderSendMode === 'excludeQuitte') {
      return this.scheduledReminderActiveClients;
    }
    return this.scheduledReminderClientsToday;
  }

  get scheduledReminderExcludedQuitteCount(): number {
    if (this.scheduledReminderSendMode !== 'excludeQuitte') return 0;
    return this.scheduledReminderQuitteClients.length;
  }

  get scheduledReminderSendModeLabel(): string {
    return this.scheduledReminderSendMode === 'excludeQuitte'
      ? 'Non quittés seulement'
      : 'Tous les planifiés';
  }

  get scheduledReminderSendModeHint(): string {
    return this.scheduledReminderSendMode === 'excludeQuitte'
      ? 'Les clients marqués quitté ne recevront pas ce rappel.'
      : 'Tous les clients planifiés aujourd’hui recevront ce rappel.';
  }

  get scheduledReminderQuitteClients(): Client[] {
    return this.scheduledReminderClientsToday.filter((client) =>
      this.isClientQuitte(client)
    );
  }

  get scheduledReminderActiveClients(): Client[] {
    return this.scheduledReminderClientsToday.filter(
      (client) => !this.isClientQuitte(client)
    );
  }

  get scheduledReminderClientStats(): {
    total: number;
    quitte: number;
    active: number;
  } {
    return {
      total: this.scheduledReminderClientsToday.length,
      quitte: this.scheduledReminderQuitteClients.length,
      active: this.scheduledReminderActiveClients.length,
    };
  }

  get filteredScheduledReminderClients(): Client[] {
    if (this.scheduledReminderClientView === 'quitte') {
      return this.scheduledReminderQuitteClients;
    }
    if (this.scheduledReminderClientView === 'active') {
      return this.scheduledReminderActiveClients;
    }
    return this.scheduledReminderClientsToday;
  }

  get visibleScheduledReminderClients(): Client[] {
    if (this.showAllScheduledReminderClients) {
      return this.filteredScheduledReminderClients;
    }
    return this.filteredScheduledReminderClients.slice(0, 4);
  }

  get hasMoreScheduledReminderClients(): boolean {
    return this.filteredScheduledReminderClients.length > 4;
  }

  get scheduledReminderClientViewLabel(): string {
    switch (this.scheduledReminderClientView) {
      case 'quitte':
        return 'quittés';
      case 'active':
        return 'non quittés';
      default:
        return 'clients';
    }
  }

  setScheduledReminderClientView(view: 'all' | 'quitte' | 'active'): void {
    if (this.scheduledReminderClientView === view) return;
    this.scheduledReminderClientView = view;
    this.showAllScheduledReminderClients = false;
  }

  scheduledReminderViewButtonClasses(view: 'all' | 'quitte' | 'active') {
    const active = this.scheduledReminderClientView === view;
    return {
      'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900':
        active,
      'text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white':
        !active,
    };
  }

  scheduledReminderSendModeButtonClasses(mode: PaymentReminderSendMode) {
    const active = this.scheduledReminderSendMode === mode;
    return {
      'bg-rose-600 text-white shadow-sm': active,
      'text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white':
        !active,
    };
  }

  async setScheduledReminderSendMode(
    mode: PaymentReminderSendMode
  ): Promise<void> {
    if (this.scheduledReminderSendMode === mode) return;

    const nextLabel =
      mode === 'excludeQuitte'
        ? 'envoyer seulement aux clients non quittés'
        : 'envoyer à tous les clients planifiés';
    const confirmed = window.confirm(
      `Changer la règle des rappels ?\n\nDésormais, le rappel collectif va ${nextLabel}.\n\nCette règle sera utilisée pour les prochains envois manuels et automatiques.`
    );
    if (!confirmed) return;

    this.scheduledReminderSettingsSaving = true;
    this.scheduledReminderSettingsError = null;
    try {
      await this.afs.doc('payment_reminder_settings/default').set(
        {
          sendMode: mode,
          updatedAtMs: Date.now(),
          updatedBy: this.auth.currentUser?.uid ?? null,
        },
        { merge: true }
      );
      this.scheduledReminderSendMode = mode;
      this.showAllScheduledReminderClients = false;
    } catch (error) {
      console.error('Payment reminder settings save failed', error);
      this.scheduledReminderSettingsError =
        'Impossible de sauvegarder la règle pour le moment.';
    } finally {
      this.scheduledReminderSettingsSaving = false;
    }
  }

  private async loadScheduledReminderSendMode(): Promise<void> {
    this.scheduledReminderSettingsLoading = true;
    this.scheduledReminderSettingsError = null;
    try {
      const snap: any = await firstValueFrom(
        this.afs.doc('payment_reminder_settings/default').get()
      );
      const data = snap?.data?.() || {};
      this.scheduledReminderSendMode =
        data.sendMode === 'excludeQuitte' ? 'excludeQuitte' : 'all';
    } catch (error) {
      console.error('Payment reminder settings load failed', error);
      this.scheduledReminderSettingsError =
        'Impossible de charger la règle; mode tous planifiés utilisé.';
      this.scheduledReminderSendMode = 'all';
    } finally {
      this.scheduledReminderSettingsLoading = false;
    }
  }

  toggleScheduledReminderClients(): void {
    if (!this.hasMoreScheduledReminderClients) return;
    this.showAllScheduledReminderClients = !this.showAllScheduledReminderClients;
  }

  trackScheduledReminderClient(index: number, client: Client): string {
    return (
      client.uid ||
      client.trackingId ||
      `${client.firstName || ''}-${client.lastName || ''}-${client.phoneNumber || index}`
    );
  }

  async setPaymentReminderDate(value: string): Promise<void> {
    if (!value || value === this.paymentReminderDateKey) return;
    this.paymentReminderDateKey = value;
    await this.loadPaymentReminderLogsForDate();
  }

  async shiftPaymentReminderDate(days: number): Promise<void> {
    const date = this.dateFromDateKey(this.paymentReminderDateKey);
    date.setDate(date.getDate() + days);
    this.paymentReminderDateKey = this.formatDateKeyForInput(date);
    await this.loadPaymentReminderLogsForDate();
  }

  async loadPaymentReminderLogsForDate(): Promise<void> {
    const requestedDateKey = this.paymentReminderDateKey;
    this.paymentReminderLogsLoading = true;
    this.paymentReminderLogsError = null;
    this.paymentReminderLogsWarning = null;

    try {
      const snap = await firstValueFrom(
        this.afs
          .collection<PaymentReminderLogDocument>(
            'payment_reminder_logs',
            (ref) =>
              ref
                .where('sentAtDateKey', '==', requestedDateKey)
                .limit(this.paymentReminderLogsLimit)
          )
          .get()
      );

      if (requestedDateKey !== this.paymentReminderDateKey) return;

      this.paymentReminderLogs = snap.docs
        .map((doc) =>
          this.transformPaymentReminderLogDocument(doc.id, doc.data())
        )
        .sort((a, b) => (b.sentAtMs || 0) - (a.sentAtMs || 0));
    } catch (error) {
      console.warn('Direct reminder log read failed; trying callable.', error);
      if (requestedDateKey === this.paymentReminderDateKey) {
        await this.loadPaymentReminderLogsViaCallable(requestedDateKey);
      }
    } finally {
      if (requestedDateKey === this.paymentReminderDateKey) {
        this.paymentReminderLogsLoading = false;
      }
    }
  }

  trackPaymentReminderLog(index: number, log: PaymentReminderLog): string {
    return log.id;
  }

  private async loadPaymentReminderLogsViaCallable(
    requestedDateKey: string
  ): Promise<void> {
    try {
      const callable = this.fns.httpsCallable('getPaymentReminderLogs');
      const result: any = await firstValueFrom(
        callable({ dateKey: requestedDateKey })
      );
      if (requestedDateKey !== this.paymentReminderDateKey) return;

      const logs = Array.isArray(result?.logs) ? result.logs : [];
      const transformedLogs: PaymentReminderLog[] = logs
        .map((log: PaymentReminderLogDocument & { id?: string }, index: number) =>
          this.transformPaymentReminderLogDocument(
            log.id || `${requestedDateKey}-${index}`,
            log
          )
        )
        .sort(
          (a: PaymentReminderLog, b: PaymentReminderLog) =>
            (b.sentAtMs || 0) - (a.sentAtMs || 0)
        );
      this.paymentReminderLogs = transformedLogs;
      this.paymentReminderLogsWarning =
        'Lecture sécurisée utilisée parce que la lecture directe est bloquée.';
    } catch (fallbackError) {
      console.error('Payment reminder logs callable failed', fallbackError);
      if (requestedDateKey === this.paymentReminderDateKey) {
        this.paymentReminderLogs = [];
        this.paymentReminderLogsError =
          'Impossible de charger les rappels pour cette date.';
      }
    }
  }

  private transformPaymentReminderLogDocument(
    id: string,
    data: PaymentReminderLogDocument | undefined
  ): PaymentReminderLog {
    const safe = data ?? {};
    const sentAtMs = Number(safe.sentAtMs) || Date.now();
    const total = Number(safe.total) || 0;
    return {
      ...safe,
      id,
      sendMode: safe.sendMode === 'excludeQuitte' ? 'excludeQuitte' : 'all',
      plannedTotal: Number(safe.plannedTotal) || total,
      total,
      succeeded: Number(safe.succeeded) || 0,
      failed: Number(safe.failed) || 0,
      quitteTotal: Number(safe.quitteTotal) || 0,
      quitteSucceeded: Number(safe.quitteSucceeded) || 0,
      excludedQuitte: Number(safe.excludedQuitte) || 0,
      skipped: Number(safe.skipped) || 0,
      sentAtMs,
      sentAtDate: new Date(sentAtMs),
      sourceLabel:
        safe.source === 'scheduled'
          ? 'Automatique'
          : safe.source === 'manual'
          ? 'Manuel'
          : 'Rappel',
    };
  }

  private dateFromDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  private formatDateKeyForInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateKeyForTimeZone(date: Date, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value;
    }
    return `${values['year']}-${values['month']}-${values['day']}`;
  }

  private formatMonthKeyForTimeZone(date: Date, timeZone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value;
    }
    return `${values['year']}-${values['month']}`;
  }

  private birthdayHistoryQueryRange(monthKey: string): {
    startMs: number;
    endMs: number;
  } {
    const [year, month] = monthKey.split('-').map(Number);
    if (!year || !month) {
      const now = Date.now();
      return { startMs: now - 32 * 24 * 60 * 60 * 1000, endMs: now };
    }

    const start = new Date(year, month - 1, 1, 0, 0, 0);
    start.setDate(start.getDate() - 1);
    const end = new Date(year, month, 1, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }

  private isBirthdayHistoryLog(log: BulkMessageLog): boolean {
    return log.type === 'birthdays' || log.type === 'birthday_tomorrow';
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

  get kinshasaNowLocal(): string {
    return this.formatDateTimeForTimeZone(new Date(), 'Africa/Kinshasa');
  }

  formatScheduleLocalLabel(value?: string): string {
    if (!value) return '—';
    return value.replace('T', ' ');
  }

  private async createScheduledBulkMessage(payload: {
    type: BulkLogContext;
    scheduledForLocal: string;
    recipients: { phoneNumber: string; message: string }[];
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

  private getLogTypeLabel(type?: BulkLogContext): string {
    switch (type) {
      case 'finished_clients':
        return 'Clients terminés';
      case 'general_filters':
        return 'Filtre personnalisé';
      case 'birthday_tomorrow':
        return 'Anniversaire demain';
      case 'birthdays':
        return 'Anniversaires';
      case 'prospect_contacts':
        return 'Prospects';
      case 'contacts':
        return 'Contacts';
      case 'custom':
        return 'Personnalisé';
      default:
        return 'Envoi groupé';
    }
  }

  private aggregateLocations<T>(
    items: T[],
    pick: (item: T) => string | null | undefined
  ): Record<string, number> {
    const totals: Record<string, number> = {};
    const fallback = 'Sans localisation';

    for (const entry of items) {
      const key = pick(entry)?.trim() || fallback;
      totals[key] = (totals[key] || 0) + 1;
    }

    return totals;
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
}
