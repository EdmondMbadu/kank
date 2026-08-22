import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { Client } from 'src/app/models/client';
import { LocationCoordinates } from 'src/app/models/user';
import { coerceToNumber } from 'src/app/utils/number-utils';
import { calculatePendingLoanBudget } from 'src/app/utils/pending-loan-budget.util';
import { of, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import {
  MoneyAvailabilityLocationOverride,
  MoneyAvailabilityPolicyActor,
  MoneyAvailabilityPolicyService,
} from 'src/app/services/money-availability-policy.service';
import {
  cloneMoneyAvailabilityRules,
  DEFAULT_MONEY_AVAILABILITY_POLICY,
  formatMoneyAvailabilityDate,
  formatMoneyAvailabilityRuleRange,
  formatOpenDaysLabel,
  getMoneyAvailability,
  MoneyAvailabilityRule,
  ResolvedMoneyAvailabilityPolicy,
  validateMoneyAvailabilityRules,
} from 'src/app/utils/money-availability.util';
type GeoStatus = 'granted' | 'prompt' | 'denied' | 'unknown';
@Component({
  selector: 'app-tracking',
  templateUrl: './tracking.component.html',
  styleUrls: ['./tracking.component.css'],
})
export class TrackingComponent implements OnDestroy {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private data: DataService,
    private moneyPolicy: MoneyAvailabilityPolicyService
  ) {}
  ngOnInit() {
    this.setCurrentMonth();
    this.listenToLocationMoneyPolicy();
    this.retrieveClients();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
  }

  retrieveClients(): void {
    this.subscriptions.push(
      this.auth.getAllClients().subscribe((data: any) => {
        this.clients = Array.isArray(data)
          ? (data.filter(Boolean) as Client[])
          : [];
        this.initalizeInputs();
      })
    );
  }
  public currentMonth: string = '';
  clients: Client[] = [];
  private subscriptions: Subscription[] = [];

  resolvedMoneyPolicy: ResolvedMoneyAvailabilityPolicy = {
    policy: DEFAULT_MONEY_AVAILABILITY_POLICY,
    source: 'fallback',
    locationId: '',
  };
  locationMoneyPolicyOverride: MoneyAvailabilityLocationOverride | null = null;
  globalMoneyPolicyRules: MoneyAvailabilityRule[] =
    cloneMoneyAvailabilityRules(DEFAULT_MONEY_AVAILABILITY_POLICY.rules);
  locationMoneyPolicyDraft: MoneyAvailabilityRule[] =
    cloneMoneyAvailabilityRules(DEFAULT_MONEY_AVAILABILITY_POLICY.rules);
  locationMoneyPolicyPreviewScore = 50;
  locationMoneyPolicySaving = false;
  locationMoneyPolicyMessage = '';
  // ---------- existing fields ----------

  withinRadius: boolean | null = null;
  errorMessage: string | null = null;
  locationSet = false;
  currentLat = 0;
  currentLng = 0;
  limitHour = 9;
  limitMinutes = 0;
  onTime = '';
  locationCoordinate: LocationCoordinates = {};
  radius = 1200;

  // ---------- new UI states ----------
  isSettingLocation = false;
  isCheckingPresence = false;
  warmingUp = false;
  geoStatus: GeoStatus = 'unknown';
  lastAccuracy?: number;
  lastDistance?: number;
  lastFixAt?: Date;

  setCurrentMonth() {
    const monthNamesFr = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    const now = new Date();
    this.currentMonth = monthNamesFr[now.getMonth()];
  }

  totalPerfomance: number = 0;
  housePayment: string = '';
  linkPaths: string[] = [
    '/client-info-current',
    '/client-info-current',
    '/tracking',
    '/add-expense',

    '/add-reserve',
    '/client-info-current',
  ];
  summary: string[] = [
    'Epargne Clients',
    'Argent en Main',
    'Budget Emprunts Du Mois',
    'Budget Réservé Aux Emprunts En Cours',
    'Depenses',

    'Reserve',
    'Benefice Réel',
  ];
  valuesConvertedToDollars: number[] = [];
  maxNumberOfClients: number = this.data.generalMaxNumberOfClients;
  objectifPerformance: string = '';

  imagePaths: string[] = [
    '../../../assets/img/saving.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/budget.png',
    '../../../assets/img/budget.png',

    '../../../assets/img/expense.svg',

    '../../../assets/img/reserve.svg',

    '../../../assets/img/revenue.svg',
  ];

  today = this.time.todaysDateMonthDayYear();

  monthBudget: string = '';
  amountBudget: string = '';
  amountBudgetPending: string = '';
  pendingLoanBudgetInvalidClientNames: string[] = [];
  summaryContent: number[] = [];
  moneyInHands: string = '';
  maxNumberOfDaysToLend: Number = 0;
  startingBudget: string = '';
  teamCode: string = '';
  savingsRequiredPercent: number = 30;

  initalizeInputs() {
    const user = this.auth.currentUser;
    if (!user) {
      this.resetTrackingState();
      return;
    }

    this.maxNumberOfClients = Number(user.maxNumberOfClients)
      ? Number(user.maxNumberOfClients)
      : this.data.generalMaxNumberOfClients;

    this.maxNumberOfDaysToLend = Number(user.maxNumberOfDaysToLend)
      ? Number(user.maxNumberOfDaysToLend)
      : this.data.generalMaxNumberOfDaysToLend;

    const totalDebtLeft = coerceToNumber(user.totalDebtLeft);
    const amountInvested = coerceToNumber(user.amountInvested);
    const realBenefit = (totalDebtLeft ?? 0) - (amountInvested ?? 0);

    this.monthBudget =
      user.monthBudget === '' || user.monthBudget === undefined
        ? '0'
        : user.monthBudget!;
    this.objectifPerformance =
      user.objectifPerformance === '' || user.objectifPerformance === undefined
        ? '0'
        : user.objectifPerformance!;
    const pendingLoanBudget = calculatePendingLoanBudget(this.clients);
    this.amountBudgetPending = pendingLoanBudget.amount.toString();
    this.pendingLoanBudgetInvalidClientNames =
      pendingLoanBudget.invalidRequests.map((request) => request.clientName);
    this.housePayment = user.housePayment ? user.housePayment : '0';
    this.moneyInHands = user.moneyInHands ? user.moneyInHands : '0';
    this.teamCode = user.teamCode ? user.teamCode : '';
    this.startingBudget = user.startingBudget ? user.startingBudget : '0';
    const requiredPercent = Number(user.savingsRequiredPercent);
    this.savingsRequiredPercent =
      Number.isFinite(requiredPercent) && requiredPercent > 0
        ? requiredPercent
        : 30;
    // `clientsSavings` is a denormalized legacy aggregate and can drift when
    // several client operations overlap or when a pending transfer is rejected.
    // The client collection is already loaded before this method runs, so use it
    // as the source of truth without adding another Firestore request.
    const clientsSavings = this.calculateClientsSavings();
    const cardsMoney = coerceToNumber(user.cardsMoney);
    const moneyInHands = coerceToNumber(user.moneyInHands);
    const enMain = (moneyInHands ?? 0) + (cardsMoney ?? 0);
    const monthBudgetNumber = coerceToNumber(this.monthBudget);
    const monthBudgetPendingNumber = pendingLoanBudget.amount;
    const expensesAmount = coerceToNumber(user.expensesAmount);
    const reserveDollar = coerceToNumber(user.reserveAmountDollar);
    const reserveCdf = coerceToNumber(
      this.compute.convertUsDollarsToCongoleseFranc(
        (reserveDollar ?? 0).toString()
      )
    );

    this.summaryContent = [
      clientsSavings ?? 0,
      enMain,
      monthBudgetNumber ?? 0,
      monthBudgetPendingNumber ?? 0,
      expensesAmount ?? 0,
      reserveCdf ?? 0,
      realBenefit,
    ];

    this.valuesConvertedToDollars = [
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(
          (clientsSavings ?? 0).toString()
        )
      ) ?? 0,
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(enMain.toString())
      ) ?? 0,
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(
          (monthBudgetNumber ?? 0).toString()
        )
      ) ?? 0,
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(
          (monthBudgetPendingNumber ?? 0).toString()
        )
      ) ?? 0,
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(
          (expensesAmount ?? 0).toString()
        )
      ) ?? 0,
      reserveDollar ?? 0,
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(realBenefit.toString())
      ) ?? 0,
    ];

    // only show the first two
    if (!this.auth.isAdmninistrator) {
      this.summary = this.compute.filterOutElements(this.summary, 4);
    }
  }

  private calculateClientsSavings(): number {
    return this.clients.reduce((total, client) => {
      // Pending transfer copies have not yet been accepted by this location and
      // must not affect its treasury totals.
      if (client.transferStatus === 'pending') return total;

      const savings = coerceToNumber(client.savings) ?? 0;
      return total + Math.max(0, savings);
    }, 0);
  }

  private resetTrackingState(): void {
    this.maxNumberOfClients = this.data.generalMaxNumberOfClients;
    this.maxNumberOfDaysToLend = this.data.generalMaxNumberOfDaysToLend;
    this.monthBudget = '0';
    this.objectifPerformance = '0';
    this.amountBudgetPending = '0';
    this.pendingLoanBudgetInvalidClientNames = [];
    this.housePayment = '0';
    this.moneyInHands = '0';
    this.teamCode = '';
    this.startingBudget = '0';
    this.savingsRequiredPercent = 30;
    this.summaryContent = [0, 0, 0, 0, 0, 0, 0];
    this.valuesConvertedToDollars = [0, 0, 0, 0, 0, 0, 0];
  }

  async setSavingsRequiredPercent(): Promise<void> {
    const value = Number(this.savingsRequiredPercent);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      alert('Entrez un pourcentage valide (1 à 100).');
      return;
    }
    await this.setUserField('savingsRequiredPercent', value);
  }

  get locationMoneyPolicyErrors(): string[] {
    return validateMoneyAvailabilityRules(this.locationMoneyPolicyDraft);
  }

  get locationMoneyPolicyPreviewLabel(): string {
    const rules =
      this.locationMoneyPolicyErrors.length === 0
        ? this.locationMoneyPolicyDraft
        : this.resolvedMoneyPolicy.policy.rules;
    const availability = getMoneyAvailability(
      Number(this.locationMoneyPolicyPreviewScore),
      new Date(),
      {
        version: this.resolvedMoneyPolicy.policy.version,
        rules,
      }
    );
    return `${formatOpenDaysLabel(
      availability.openDays
    )} · ${formatMoneyAvailabilityDate(availability.earliestDate)}`;
  }

  get locationMoneyPolicySourceLabel(): string {
    return this.resolvedMoneyPolicy.source === 'location'
      ? 'Dérogation de cette localisation'
      : 'Règle générale';
  }

  trackingMoneyPolicyRangeLabel(rule: MoneyAvailabilityRule): string {
    return formatMoneyAvailabilityRuleRange(rule);
  }

  onTrackingMoneyPolicyMaxScoreChange(index: number): void {
    const current = this.locationMoneyPolicyDraft[index];
    const next = this.locationMoneyPolicyDraft[index + 1];
    if (!current || !next || current.maxScore === null) return;
    const maxScore = Number(current.maxScore);
    if (Number.isInteger(maxScore)) {
      current.maxScore = maxScore;
      next.minScore = maxScore + 1;
    }
  }

  addTrackingMoneyPolicyRule(): void {
    const rules = this.locationMoneyPolicyDraft;
    const lastIndex = rules.length - 1;
    const last = rules[lastIndex];
    if (!last || last.minScore === null) return;
    const splitEnd = last.minScore + 9;
    rules.splice(lastIndex, 0, {
      id: `custom-${Date.now()}`,
      minScore: last.minScore,
      maxScore: splitEnd,
      openDays: last.openDays,
    });
    last.minScore = splitEnd + 1;
    this.locationMoneyPolicyMessage = '';
  }

  removeTrackingMoneyPolicyRule(index: number): void {
    const rules = this.locationMoneyPolicyDraft;
    if (rules.length <= 2 || index < 0 || index >= rules.length) return;
    const removed = rules[index];
    if (index === 0) {
      rules[index + 1].minScore = null;
    } else {
      rules[index - 1].maxScore = removed.maxScore;
    }
    rules.splice(index, 1);
    this.locationMoneyPolicyMessage = '';
  }

  copyGlobalPolicyToLocationDraft(): void {
    this.locationMoneyPolicyDraft = cloneMoneyAvailabilityRules(
      this.globalMoneyPolicyRules
    );
  }

  async saveTrackingLocationMoneyPolicy(): Promise<void> {
    const locationId = this.auth.currentUser?.uid || '';
    if (
      !this.auth.isAdmninistrator ||
      !locationId ||
      this.locationMoneyPolicySaving
    ) {
      return;
    }
    if (this.locationMoneyPolicyErrors.length > 0) {
      this.locationMoneyPolicyMessage =
        this.locationMoneyPolicyErrors.join(' ');
      return;
    }

    this.locationMoneyPolicySaving = true;
    this.locationMoneyPolicyMessage = '';
    try {
      await this.ensureTrackingMoneyPolicyAdminWriteAccess();
      await this.moneyPolicy.saveLocationOverride(
        locationId,
        this.locationMoneyPolicyDraft,
        this.trackingMoneyPolicyActor()
      );
      this.locationMoneyPolicyMessage =
        'Dérogation enregistrée pour cette localisation.';
    } catch (error: any) {
      this.locationMoneyPolicyMessage =
        error?.message || "Impossible d'enregistrer la dérogation.";
    } finally {
      this.locationMoneyPolicySaving = false;
    }
  }

  async disableTrackingLocationMoneyPolicy(): Promise<void> {
    const locationId = this.auth.currentUser?.uid || '';
    if (
      !this.auth.isAdmninistrator ||
      !locationId ||
      this.locationMoneyPolicySaving ||
      this.resolvedMoneyPolicy.source !== 'location'
    ) {
      return;
    }

    this.locationMoneyPolicySaving = true;
    this.locationMoneyPolicyMessage = '';
    try {
      await this.ensureTrackingMoneyPolicyAdminWriteAccess();
      await this.moneyPolicy.disableLocationOverride(
        locationId,
        this.trackingMoneyPolicyActor()
      );
      this.locationMoneyPolicyDraft = cloneMoneyAvailabilityRules(
        this.globalMoneyPolicyRules
      );
      this.locationMoneyPolicyMessage =
        'Dérogation désactivée. La règle générale est de nouveau active.';
    } catch (error: any) {
      this.locationMoneyPolicyMessage =
        error?.message || 'Impossible de désactiver la dérogation.';
    } finally {
      this.locationMoneyPolicySaving = false;
    }
  }

  private listenToLocationMoneyPolicy(): void {
    this.subscriptions.push(
      this.moneyPolicy.globalPolicy$.subscribe((policy) => {
        this.globalMoneyPolicyRules = cloneMoneyAvailabilityRules(policy.rules);
      })
    );
    this.subscriptions.push(
      (this.auth.user$ || of(this.auth.currentUser))
        .pipe(
          switchMap((user) =>
            this.moneyPolicy.resolvedPolicy$(
              user?.uid || this.auth.currentUser?.uid || ''
            )
          )
        )
        .subscribe((resolved) => {
          this.resolvedMoneyPolicy = resolved;
          if (!this.locationMoneyPolicySaving) {
            this.locationMoneyPolicyDraft = cloneMoneyAvailabilityRules(
              resolved.policy.rules
            );
          }
        })
    );
    this.subscriptions.push(
      (this.auth.user$ || of(this.auth.currentUser))
        .pipe(
          switchMap((user) =>
            this.moneyPolicy.locationOverride$(
              user?.uid || this.auth.currentUser?.uid || ''
            )
          )
        )
        .subscribe((override) => {
          this.locationMoneyPolicyOverride = override;
        })
    );
  }

  private trackingMoneyPolicyActor(): MoneyAvailabilityPolicyActor {
    const user = this.auth.currentUser || {};
    return {
      uid: user.uid || '',
      name:
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.email ||
        'Administrateur',
    };
  }

  private async ensureTrackingMoneyPolicyAdminWriteAccess(): Promise<void> {
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

  async setUserField(field: string, value: any, pass = '') {
    if (!this.compute.isNumber(value) && !pass) {
      alert('Enter a valid number');
      return;
    }
    try {
      const val = await await this.auth.setUserField(field, value);
      alert('Montant changer avec succès');
      this.initalizeInputs();
    } catch (err) {
      alert("Une erreur s'est produite lors du placement du budget, Réessayez");
      return;
    }
  }

  isNumber(value: string): boolean {
    return !isNaN(Number(value));
  }

  private async checkGeoPermission() {
    try {
      // Permissions API is not supported everywhere; guard it.
      const nav: any = navigator as any;
      if (!nav.permissions || !nav.permissions.query) {
        this.geoStatus = 'unknown';
        return;
      }
      const status = await nav.permissions.query({
        name: 'geolocation' as PermissionName,
      });
      this.geoStatus = (status.state as GeoStatus) || 'unknown';
      status.onchange = () => {
        this.geoStatus = (status.state as GeoStatus) || 'unknown';
      };
    } catch {
      this.geoStatus = 'unknown';
    }
  }

  async warmUpGps() {
    if (this.warmingUp) return;
    this.warmingUp = true;
    this.errorMessage = null;
    try {
      // Use best-effort watch for ~10 seconds to prime the GPS
      await this.compute.bestEffortGetLocation(10000);
    } catch (e: any) {
      // no-op: warm-up is best effort
      this.errorMessage = e?.message || null;
    } finally {
      this.warmingUp = false;
    }
  }

  async setLocation(): Promise<void> {
    if (this.isSettingLocation || this.isCheckingPresence) return;
    this.isSettingLocation = true;
    this.errorMessage = null;
    this.withinRadius = null;

    try {
      // Give more time for accurate fix when defining the workplace
      const pos = await this.compute.bestEffortGetLocation(25000);
      this.currentLat = pos.coords.latitude;
      this.currentLng = pos.coords.longitude;
      this.lastAccuracy = Math.round(pos.coords.accuracy);
      this.lastFixAt = new Date();

      this.locationSet = true;

      const loc: LocationCoordinates = {
        longitude: this.currentLng.toString(),
        lattitude: this.currentLat.toString(),
      };
      try {
        await this.data.setLocation(loc);
      } catch (err) {
        this.errorMessage =
          'Échec d’enregistrement de l’emplacement. Réessayez.';
        console.error(err);
      }
    } catch (err: any) {
      this.errorMessage = err?.message || 'Localisation impossible.';
      this.locationSet = false;
    } finally {
      this.isSettingLocation = false;
      this.checkGeoPermission();
    }
  }

  async checkPresence(): Promise<void> {
    if (this.isSettingLocation || this.isCheckingPresence) return;

    if (
      !Number.isFinite(this.currentLat) ||
      !Number.isFinite(this.currentLng) ||
      !this.locationSet
    ) {
      this.errorMessage =
        "Emplacement du travail non défini. Veuillez d'abord le définir.";
      this.withinRadius = null;
      return;
    }

    this.isCheckingPresence = true;
    this.errorMessage = null;
    try {
      const pos = await this.compute.bestEffortGetLocation(15000);
      const { latitude, longitude, accuracy } = pos.coords;

      this.lastAccuracy = Math.round(accuracy);
      this.lastFixAt = new Date();

      this.withinRadius = this.compute.checkWithinRadius(
        latitude,
        longitude,
        this.currentLat,
        this.currentLng,
        this.radius,
        accuracy
      );

      const distance = this.compute.calculateDistance(
        latitude,
        longitude,
        this.currentLat,
        this.currentLng
      );
      this.lastDistance = Math.round(distance);

      this.onTime = this.time.isEmployeeOnTime(
        this.limitHour,
        this.limitMinutes
      )
        ? "À l'heure"
        : 'En retard';
    } catch (err: any) {
      this.errorMessage = err?.message || 'Localisation impossible.';
      this.withinRadius = null;
    } finally {
      this.isCheckingPresence = false;
      this.checkGeoPermission();
    }
  }
}
