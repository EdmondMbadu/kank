import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-today-central',
  templateUrl: './today-central.component.html',
  styleUrls: ['./today-central.component.css'],
})
export class TodayCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}

  allUsers: User[] = [];
  ngOnInit(): void {
    // if (this.auth.isAdmin) {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      this.initalizeInputs();
    });
    // }
  }
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  dailyLending: string = '0';
  dailyPayment: string = '0';
  dailyPaymentDollars: string = '0';
  dailyReserve: string = '0';
  dailyReserveDollars: string = '0';
  dailyInvestement: string = '0';
  dailySaving: string = '0';
  dailySavingReturns = '0';
  dailyRequest: string = '0';
  dailyRequestDollars: string = '0';
  dailyExpense: string = '0';
  dailyFeesReturns: string = '0';
  dailyLoss: string = '0';

  sortedReserveToday: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedPaymentToday: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedRequestedTomorrow: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  totalPerfomance: number = 0;
  linkPaths: string[] = ['/daily-payments', '/daily-lendings', '/add-expense'];
  summary: string[] = [
    'Paiement Du Jour',
    'Emprunt Du Jour',
    'Reserve Du Jour',
    'Entrée Du Jour',
    'Epargne Du Jour',
    'Retrait Epargne Du Jour',
    'Depense Du Jour',
    `Retrait Frais De Membre Du Jour`,
    'Perte Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/return.png',
    '../../../assets/img/loss.png',
  ];

  today = this.time.todaysDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  summaryContent: string[] = [];
  initalizeInputs() {
    this.dailyLending = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyLending',
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyPayment = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyReimbursement',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyReserve = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'reserve',
        this.requestDateCorrectFormat
      )
      .toString();
    let tomorrow = this.findNextDay(this.requestDateCorrectFormat);

    this.dailyRequest = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyMoneyRequests',
        tomorrow
      )
      .toString();
    this.dailyInvestement = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'investments',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailySaving = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailySaving',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailySavingReturns = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailySavingReturns',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyFeesReturns = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyFeesReturns',
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyExpense = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'expenses',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyLoss = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'losses',
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;
    this.dailyReserve =
      this.dailyReserve === undefined ? '0' : this.dailyReserve;
    this.dailyInvestement =
      this.dailyInvestement === undefined ? '0' : this.dailyInvestement;
    this.dailySaving = this.dailySaving === undefined ? '0' : this.dailySaving;
    this.dailyRequest =
      this.dailyRequest === undefined ? '0' : this.dailyRequest;
    this.dailyExpense =
      this.dailyExpense === undefined ? '0' : this.dailyExpense;
    this.dailyFeesReturns =
      this.dailyFeesReturns === undefined ? '0' : this.dailyFeesReturns;
    this.dailyLoss = this.dailyLoss === undefined ? '0' : this.dailyLoss;
    this.dailyReserveDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyReserve)
      .toString();
    this.dailyPaymentDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyPayment)
      .toString();
    this.dailyRequestDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyRequest)
      .toString();

    this.sortedReserveToday =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        this.requestDateCorrectFormat,
        this.allUsers,
        'reserve'
      );
    this.sortedPaymentToday =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        this.requestDateCorrectFormat,
        this.allUsers,
        'dailyReimbursement'
      );
    this.sortedRequestedTomorrow =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        tomorrow,
        this.allUsers,
        'dailyMoneyRequests'
      );
    this.summaryContent = [
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
      `${this.dailyReserve}`,
      `${this.dailyInvestement}`,
      `${this.dailySaving}`,
      `${this.dailySavingReturns}`,
      `${this.dailyExpense}`,
      `${this.dailyFeesReturns}`,
      `${this.dailyLoss}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyPayment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLending)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyReserve)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyInvestement)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailySaving)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailySavingReturns
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyExpense)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyFeesReturns)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLoss)}`,
    ];
  }

  get todaySummaryCards() {
    return this.summary.map((title, index) => ({
      index,
      title,
      icon: this.imagePaths[index] ?? this.imagePaths[0],
      amountFc: this.toNum(this.summaryContent[index]),
      amountUsd: this.toNum(this.valuesConvertedToDollars[index]),
      link: this.linkPaths[index] ?? null,
    }));
  }

  get heroSnapshot() {
    return [
      {
        label: 'Paiements',
        value: this.toNum(this.dailyPayment),
        valueUsd: this.toNum(this.dailyPaymentDollars),
        icon: '💸',
      },
      {
        label: 'Réserves',
        value: this.toNum(this.dailyReserve),
        valueUsd: this.toNum(this.dailyReserveDollars),
        icon: '🏦',
      },
      {
        label: 'Demandes',
        value: this.toNum(this.dailyRequest),
        valueUsd: this.toNum(this.dailyRequestDollars),
        icon: '📅',
      },
    ];
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByLabel(_index: number, item: { label: string }): string {
    return item.label;
  }

  findDailyActivitiesCentralAmount() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );

    this.initalizeInputs();
  }
  findNextDay(dateStr: string) {
    // Parse the date string into a Date object
    const [month, day, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // Add one day to the date
    date.setDate(date.getDate() + 1);

    // Get the day, month, and year without leading zeros
    const nextDay = date.getDate();
    const nextMonth = date.getMonth() + 1;
    const nextYear = date.getFullYear();

    return `${nextMonth}-${nextDay}-${nextYear}`;
  }
  // Helpers: robust to string|number and flexible field names
  toNum(v: any): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/\s/g, ''));
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }
  val(obj: any, ...keys: string[]): any {
    if (!obj) return 0;
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return 0;
  }
  percentOf(value: any, basis: any): number {
    const v = this.toNum(value);
    const b = this.toNum(basis) || 1;
    return Math.max(0, (v / b) * 100);
  }

  // Baselines for today/tomorrow (bars = % of max $)
  get reserveTodayUSDMax(): number {
    const list = this.sortedReserveToday ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalReserveInDollars',
          'totalPaymentInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }
  get paymentTodayUSDMax(): number {
    const list = this.sortedPaymentToday ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalPaymentInDollars',
          'totalReserveInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }
  get requestTomorrowUSDMax(): number {
    const list = this.sortedRequestedTomorrow ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalRequestedInDollars',
          'totalReserveInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }
}
