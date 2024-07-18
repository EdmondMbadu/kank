import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
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
    if (this.auth.isAdmin) {
      this.auth.getAllUsersInfo().subscribe((data) => {
        this.allUsers = data;
        this.initalizeInputs();
      });
    }
  }
  dailyLending: string = '0';
  dailyPayment: string = '0';
  dailyReserve: string = '0';
  dailyInvestement: string = '0';
  dailySaving: string = '0';
  dailySavingReturns = '0';

  sortedReserveToday: {
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
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/saving.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = '';
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

    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;
    this.dailyReserve =
      this.dailyReserve === undefined ? '0' : this.dailyReserve;
    this.dailyInvestement =
      this.dailyInvestement === undefined ? '0' : this.dailyInvestement;
    this.dailySaving = this.dailySaving === undefined ? '0' : this.dailySaving;

    this.sortedReserveToday =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        this.requestDateCorrectFormat,
        this.allUsers,
        'reserve'
      );
    this.summaryContent = [
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
      `${this.dailyReserve}`,
      `${this.dailyInvestement}`,
      `${this.dailySaving}`,
      `${this.dailySavingReturns}`,
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
    ];
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
}
