import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { Client } from 'src/app/models/client';
import { LocationCoordinates } from 'src/app/models/user';

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

  withinRadius: boolean | null = null;
  errorMessage: string | null = null;
  locationSet: boolean = false;
  currentLat: number = 0;
  currentLng: number = 0;

  limitHour: number = 9;
  limitMinutes: number = 0;
  onTime: string = '';

  locationCoordinate: LocationCoordinates = {};
  radius = 1200; //Set your desired radius in meters.
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
  valuesConvertedToDollars: string[] = [];
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
  summaryContent: string[] = [];
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

    let realBenefit = (
      Number(this.auth.currentUser.totalDebtLeft) -
      Number(this.auth.currentUser.amountInvested)
    ).toString();
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
    let cardM =
      this.auth.currentUser.cardsMoney === undefined
        ? '0'
        : this.auth.currentUser.cardsMoney;
    let ts = this.data.findTotalClientSavings(this.clients!);

    let enMain = Number(this.auth.currentUser.moneyInHands) + Number(cardM);
    this.summaryContent = [
      ` ${this.auth.currentUser.clientsSavings}`,
      ` ${enMain}`,
      `${this.monthBudget}`,
      `${this.amountBudgetPending}`,
      ` ${this.auth.currentUser.expensesAmount}`,

      ` ${this.compute.convertUsDollarsToCongoleseFranc(
        this.auth.currentUser.reserveAmountDollar
      )}`,

      `${realBenefit}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.clientsSavings
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(enMain.toString())}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.monthBudget)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.amountBudgetPending
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.expensesAmount
      )}`,

      ` ${this.auth.currentUser.reserveAmountDollar}`,

      `${this.compute.convertCongoleseFrancToUsDollars(realBenefit)}`,
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

  setLocation(): void {
    this.compute
      .getLocation()
      .then((position) => {
        this.currentLat = position.coords.latitude;
        this.currentLng = position.coords.longitude;
        this.locationSet = true;
        if (this.locationSet) {
          alert("l'emplacement a été défini!");
        }
        this.errorMessage = null; // Clear any previous error
        const loc: LocationCoordinates = {
          longitude: this.currentLng.toString(),
          lattitude: this.currentLat.toString(),
        };
        try {
          // add location to the database
          const setL = this.data.setLocation(loc);
        } catch (error) {
          alert("Une erreur s'est produite. Veuillez réessayer.");
          console.error('Error setting location:', error);
          this.errorMessage = 'Failed to set location. Please try again.';
        }
        console.log(
          `Location set: Latitude ${this.currentLat}, Longitude ${this.currentLng}`
        );
      })
      .catch((error) => {
        this.errorMessage = error.message;
        this.locationSet = false;
      });
  }

  async checkPresence(): Promise<void> {
    if (
      !Number.isFinite(this.currentLat) ||
      !Number.isFinite(this.currentLng)
    ) {
      this.errorMessage =
        "Emplacement du travail non défini. Veuillez d'abord le définir.";
      return;
    }

    try {
      const pos = await this.compute.bestEffortGetLocation();
      const { latitude, longitude, accuracy } = pos.coords;

      this.withinRadius = this.compute.checkWithinRadius(
        latitude,
        longitude,
        this.currentLat,
        this.currentLng,
        this.radius,
        accuracy
      );

      // Optional: debug info for the UI
      const distance = this.compute.calculateDistance(
        latitude,
        longitude,
        this.currentLat,
        this.currentLng
      );
      this.onTime = this.time.isEmployeeOnTime(
        this.limitHour,
        this.limitMinutes
      )
        ? "À l'heure"
        : 'En retard';

      // (Nice to have) expose this somewhere in the template:
      // Distance: {{ lastDistance | number:'1.0-0' }} m — Précision: ±{{ lastAccuracy | number:'1.0-0' }} m
      (this as any).lastDistance = Math.round(distance);
      (this as any).lastAccuracy = Math.round(accuracy);

      this.errorMessage = null;
    } catch (err: any) {
      this.errorMessage = err?.message || 'Localisation impossible.';
      this.withinRadius = null;
    }
  }
}
