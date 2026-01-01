import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-tracking-card-month',
  templateUrl: './tracking-card-month.component.html',
  styleUrls: ['./tracking-card-month.component.css'],
})
export class TrackingCardMonthComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    public time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }

  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  yearsList: number[] = this.time.yearsList;
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  monthYear = `${this.month} ${this.year}`;
  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/client-info-card',
    '/client-info-card',
    '/client-info-card',
  ];
  summary: string[] = [
    'Paiment Carte Du Mois',
    'Retrait Carte Du Mois',
    'Benefice Carte Du Mois ',
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
    this.givenMonthTotalCardPaymentAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.dailyCardPayments,
      this.givenMonth,
      this.givenYear
    );

    this.givenMonthTotalCardReturnAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.dailyCardReturns,
      this.givenMonth,
      this.givenYear
    );

    this.givenMonthTotalCardBenefitAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.dailyCardBenefits,
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
