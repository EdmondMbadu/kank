import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { Client } from 'src/app/models/client';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-today',
  templateUrl: './today.component.html',
  styleUrls: ['./today.component.css'],
})
export class TodayComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    public compute: ComputationService,
    private data: DataService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;

      this.findClientsWithDebts();
    });
  }
  clients?: Client[] = [];
  clientsWithDebts: Client[] = [];

  dailyLending: string = '0';
  dailyPayment: string = '0';
  dailyFees: string = '0';
  dailyReserve: string = '0';
  dailyInvestment: string = '0';
  dailySaving: string = '0';
  dailySavingReturns: string = '0';
  dailyFeesReturns: string = '0';
  dailyMoneyRequests: string = '0';
  tomorrowMoneyRequests: string = '0';
  dailyExpense: string = '0';
  dailyLoss: string = '0';
  expectedReserve: string = '0';
  expectedReserveInDollars: string = '0';

  totalPerfomance: number = 0;

  linkPaths: string[] = [
    '/not-paid-today',
    '/daily-payments',
    '/daily-lendings',
    '/daily-fees',
    '/add-reserve',
    '/add-investment',
    '/daily-savings',
    '/daily-savings-returns',
    '/daily-returns',
    '/request-today',
    '/request-tomorrow',
    '/add-expense',
    '/add-loss',
  ];
  summary: string[] = [
    "N'ont pas Payé Aujourdhui",
    'Paiement Du Jour',
    'Emprunt Du Jour',
    'Frais De Membre Du Jour',
    'Reserve Du Jour',
    'Entrée Du Jour',
    'Epargne Du Jour',
    'Retrait Epargne Du Jour',
    `Retrait Frais De Membre Du Jour`,
    'Argent Demandé Pour Aujourdhui',
    'Argent Demandé Pour Demain',
    'Depense Du Jour',
    'Perte Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/late-payment.png',
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/member.svg',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/return.png',
    '../../../assets/img/request-money.png',
    '../../../assets/img/request-money.png',
    '../../../assets/img/expense.svg',
    '../../../assets/img/loss.png',
  ];

  today = this.time.todaysDateMonthDayYear();
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  day: string = new Date().toLocaleString('en-US', { weekday: 'long' });
  summaryContent: string[] = [];

  initalizeInputs() {
    console.log('the date ', this.requestDateCorrectFormat);
    this.dailyLending =
      this.auth.currentUser?.dailyLending?.[this.requestDateCorrectFormat] ??
      '0';
    this.dailySaving =
      this.auth.currentUser?.dailySaving?.[this.requestDateCorrectFormat] ??
      '0';
    this.dailySavingReturns =
      this.auth.currentUser?.dailySavingReturns?.[
        this.requestDateCorrectFormat
      ] ?? '0';
    this.dailyFeesReturns =
      this.auth.currentUser?.dailyFeesReturns?.[
        this.requestDateCorrectFormat
      ] ?? '0';

    console.log('fees returns', this.dailyFeesReturns);
    this.dailyMoneyRequests =
      this.auth.currentUser?.dailyMoneyRequests?.[
        this.requestDateCorrectFormat
      ] ?? '0';
    this.tomorrowMoneyRequests =
      this.auth.currentUser?.dailyMoneyRequests?.[this.tomorrow] ?? '0';
    this.dailyPayment =
      this.auth.currentUser?.dailyReimbursement?.[
        this.requestDateCorrectFormat
      ] ?? '0';
    this.dailyFees =
      this.auth.currentUser?.feesData?.[this.requestDateCorrectFormat] ?? '0';
    this.dailyReserve = this.compute
      .findTotalForToday(
        this.auth.currentUser.reserve,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyExpense = this.compute
      .findTotalForToday(
        this.auth.currentUser.expenses,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyLoss = this.compute
      .findTotalForToday(
        this.auth.currentUser.losses,
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyInvestment = this.compute
      .findTotalForToday(
        this.auth.currentUser.investments,
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyMoneyRequests =
      this.dailyMoneyRequests === undefined ? '0' : this.dailyMoneyRequests;
    this.tomorrowMoneyRequests =
      this.tomorrowMoneyRequests === undefined
        ? '0'
        : this.tomorrowMoneyRequests;
    this.summaryContent = [
      ``,
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
      ` ${this.dailyFees}`,
      ` ${this.dailyReserve}`,
      `${this.dailyInvestment}`,
      `${this.dailySaving}`,
      `${this.dailySavingReturns}`,
      `${this.dailyFeesReturns}`,
      '',
      '',
      `${this.dailyExpense}`,
      `${this.dailyLoss}`,
      // `${this.tomorrowMoneyRequests}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyPayment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLending)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyFees)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyReserve)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyInvestment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailySaving)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailySavingReturns
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyFeesReturns)}`,
      ``,
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyExpense)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLoss)}`,
      // `${this.compute.convertCongoleseFrancToUsDollars(
      //   this.dailyMoneyRequests
      // )}`,
      // `${this.compute.convertCongoleseFrancToUsDollars(
      //   this.tomorrowMoneyRequests
      // )}`,
    ];
  }

  findDailyActivitiesAmount() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );

    this.initalizeInputs();
  }
  findClientsWithDebts() {
    let total = 0;
    console.log(' today', this.day);

    // Filter clients who have debt and whose payment day matches today
    this.clientsWithDebts = this.clients!.filter((data) => {
      return (
        Number(data.debtLeft) > 0 &&
        data.paymentDay === this.day &&
        this.data.didClientStartThisWeek(data)
      );
    });
    console.log('clients with debts for today', this.clientsWithDebts);

    // Calculate the total debt for these clients
    this.expectedReserve = this.compute
      .computeExpectedPerDate(this.clientsWithDebts)
      .toString();
    this.expectedReserveInDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.expectedReserve)
      .toString();

    console.log(`Total debt for clients with payments due today: ${total}`);
  }
}
