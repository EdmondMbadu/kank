import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { Client } from 'src/app/models/client';
import { LocationCoordinates } from 'src/app/models/user';
type GeoStatus = 'granted' | 'prompt' | 'denied' | 'unknown';
@Component({
  selector: 'app-tracking',
  templateUrl: './tracking.component.html',
  styleUrls: ['./tracking.component.css'],
})
export class TrackingComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private data: DataService
  ) {}
  ngOnInit() {
    this.setCurrentMonth();
    this.retrieveClients();
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.initalizeInputs();
    });
  }
  public currentMonth: string = '';
  clients: Client[] = [];
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
    'Budget Emprunts Du Mois En Cours',
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
  summaryContent: number[] = [];
  moneyInHands: string = '';
  maxNumberOfDaysToLend: Number = 0;
  startingBudget: string = '';
  teamCode: string = '';

  initalizeInputs() {
    this.maxNumberOfClients = Number(this.auth.currentUser.maxNumberOfClients)
      ? Number(this.auth.currentUser.maxNumberOfClients)
      : this.data.generalMaxNumberOfClients;

    this.maxNumberOfDaysToLend = Number(
      this.auth.currentUser.maxNumberOfDaysToLend
    )
      ? Number(this.auth.currentUser.maxNumberOfDaysToLend)
      : this.data.generalMaxNumberOfDaysToLend;

    const totalDebtLeft = this.toFiniteNumber(
      this.auth.currentUser.totalDebtLeft
    );
    const amountInvested = this.toFiniteNumber(
      this.auth.currentUser.amountInvested
    );
    const realBenefit = (totalDebtLeft ?? 0) - (amountInvested ?? 0);

    this.monthBudget =
      this.auth.currentUser.monthBudget === ''
        ? '0'
        : this.auth.currentUser.monthBudget;
    this.objectifPerformance =
      this.auth.currentUser.objectifPerformance === ''
        ? '0'
        : this.auth.currentUser.objectifPerformance;
    this.amountBudgetPending =
      this.auth.currentUser.monthBudgetPending === ''
        ? '0'
        : this.auth.currentUser.monthBudgetPending;
    this.housePayment = this.auth.currentUser.housePayment
      ? this.auth.currentUser.housePayment
      : '0';
    this.moneyInHands = this.auth.currentUser.moneyInHands
      ? this.auth.currentUser.moneyInHands
      : '0';
    this.teamCode = this.auth.currentUser.teamCode
      ? this.auth.currentUser.teamCode
      : '';
    this.startingBudget = this.auth.currentUser.startingBudget
      ? this.auth.currentUser.startingBudget
      : '0';
    const clientsSavings = this.toFiniteNumber(
      this.auth.currentUser.clientsSavings
    );
    const cardsMoney = this.toFiniteNumber(this.auth.currentUser.cardsMoney);
    const moneyInHands = this.toFiniteNumber(
      this.auth.currentUser.moneyInHands
    );
    const enMain = (moneyInHands ?? 0) + (cardsMoney ?? 0);
    const monthBudgetNumber = this.toFiniteNumber(this.monthBudget);
    const monthBudgetPendingNumber = this.toFiniteNumber(
      this.amountBudgetPending
    );
    const expensesAmount = this.toFiniteNumber(
      this.auth.currentUser.expensesAmount
    );
    const reserveDollar = this.toFiniteNumber(
      this.auth.currentUser.reserveAmountDollar
    );
    const reserveCdf = this.toFiniteNumber(
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
      this.toFiniteNumber(
        this.compute.convertCongoleseFrancToUsDollars(
          (clientsSavings ?? 0).toString()
        )
      ) ?? 0,
      this.toFiniteNumber(
        this.compute.convertCongoleseFrancToUsDollars(enMain.toString())
      ) ?? 0,
      this.toFiniteNumber(
        this.compute.convertCongoleseFrancToUsDollars(
          (monthBudgetNumber ?? 0).toString()
        )
      ) ?? 0,
      this.toFiniteNumber(
        this.compute.convertCongoleseFrancToUsDollars(
          (monthBudgetPendingNumber ?? 0).toString()
        )
      ) ?? 0,
      this.toFiniteNumber(
        this.compute.convertCongoleseFrancToUsDollars(
          (expensesAmount ?? 0).toString()
        )
      ) ?? 0,
      reserveDollar ?? 0,
      this.toFiniteNumber(
        this.compute.convertCongoleseFrancToUsDollars(realBenefit.toString())
      ) ?? 0,
    ];

    // only show the first two
    if (!this.auth.isAdmninistrator) {
      this.summary = this.compute.filterOutElements(this.summary, 4);
    }
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

  private toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const normalized = value
      .toString()
      .trim()
      .replace(/[^0-9.-]+/g, '');

    if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
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
