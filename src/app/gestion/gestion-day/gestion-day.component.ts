import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-day',
  templateUrl: './gestion-day.component.html',
  styleUrls: ['./gestion-day.component.css'],
})
export class GestionDayComponent implements OnInit {
  managementInfo?: Management = {};
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit(): void {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      console.log('hello', this.managementInfo);
    });
  }

  dailyLending: string = '0';
  dailyPayment: string = '0';
  dailyFees: string = '0';
  dailyReserve: string = '0';
  dailyInvestment: string = '0';
  dailySaving: string = '0';
  dailySavingReturns: string = '0';
  dailyMoneyRequests: string = '0';
  tomorrowMoneyRequests: string = '0';

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
    '/request-today',
    '/request-tomorrow',
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
    'Argent Demandé Pour Aujourdhui',
    'Argent Demandé Pour Demain',
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
    '../../../assets/img/request-money.png',
    '../../../assets/img/request-money.png',
  ];

  today = this.time.todaysDateMonthDayYear();
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  summaryContent: string[] = [];
  initalizeInputs() {
    this.dailyLending =
      this.auth.currentUser.dailyLending[this.requestDateCorrectFormat];
    this.dailySaving =
      this.auth.currentUser.dailySaving[this.requestDateCorrectFormat];
    this.dailySavingReturns =
      this.auth.currentUser.dailySavingReturns[this.requestDateCorrectFormat];
    this.dailyMoneyRequests =
      this.auth.currentUser.dailyMoneyRequests[this.requestDateCorrectFormat];
    this.tomorrowMoneyRequests =
      this.auth.currentUser.dailyMoneyRequests[this.tomorrow];
    this.dailyPayment =
      this.auth.currentUser.dailyReimbursement[this.requestDateCorrectFormat];
    this.dailyFees =
      this.auth.currentUser.feesData[this.requestDateCorrectFormat];
    this.dailyReserve = this.compute
      .findTotalForToday(this.auth.currentUser.reserve)
      .toString();

    this.dailyInvestment = this.compute
      .findTotalForToday(this.auth.currentUser.investments)
      .toString();

    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;
    this.dailyFees = this.dailyFees === undefined ? '0' : this.dailyFees;
    this.dailyReserve =
      this.dailyReserve === undefined ? '0' : this.dailyReserve;
    this.dailyInvestment =
      this.dailyInvestment === undefined ? '0' : this.dailyInvestment;
    this.dailySaving = this.dailySaving === undefined ? '0' : this.dailySaving;
    this.dailySavingReturns =
      this.dailySavingReturns === undefined ? '0' : this.dailySavingReturns;
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
      '',
      '',
      // `${this.dailyMoneyRequests}`,
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
      ``,
      ``,
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
}
