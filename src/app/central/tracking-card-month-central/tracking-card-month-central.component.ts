import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-tracking-card-month-central',
  templateUrl: './tracking-card-month-central.component.html',
  styleUrls: ['./tracking-card-month-central.component.css'],
})
export class TrackingCardMonthCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    public time: TimeService,
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

  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  yearsList: number[] = [2023, 2024];
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  monthYear = `${this.month} ${this.year}`;
  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/client-info-card',
    '/client-info-card',
    '/client-info-card',
  ];
  summary: string[] = [
    'Paiment Carte Du Mois Central',
    'Retrait Carte Du Mois Central',
    'Benefice Carte Du Mois Central ',
  ];
  valuesConvertedToDollars: string[] = [];
  givenMonthTotalCardPaymentAmount: string = '';
  givenMonthTotalCardBenefitAmount: string = '';
  givenMonthTotalCardReturnAmount: string = '';

  imagePaths: string[] = [
    '../../../assets/img/audit.png',
    '../../../assets/img/lending-date.png',
    '../../../assets/img/benefit.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    this.givenMonthTotalCardPaymentAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailyCardPayments',
        this.givenMonth,
        this.givenYear
      );

    this.givenMonthTotalCardReturnAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailyCardReturns',
        this.givenMonth,
        this.givenYear
      );

    this.givenMonthTotalCardBenefitAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailyCardBenefits',
        this.givenMonth,
        this.givenYear
      );

    this.summaryContent = [
      `${this.givenMonthTotalCardPaymentAmount}`,
      `${this.givenMonthTotalCardReturnAmount}`,
      `${this.givenMonthTotalCardBenefitAmount}`,
    ];
    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalCardPaymentAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalCardReturnAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalCardBenefitAmount
      )}`,
    ];
  }
}
