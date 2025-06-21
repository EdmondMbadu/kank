import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-today-card',
  templateUrl: './today-card.component.html',
  styleUrls: ['./today-card.component.css'],
})
export class TodayCardComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }
  // today-card.component.ts  (new ↑ lines marked with // NEW)

  requestDate: string = this.time.getTodaysDateYearMonthDay(); // NEW
  requestDateCorrectFormat = this.time.todaysDateMonthDayYear(); // NEW
  frenchDate = this.time.convertDateToDayMonthYear(
    // NEW
    this.requestDateCorrectFormat
  ); // NEW

  dailyCardPayments: string = '0';
  dailyCardReturns: string = '0';
  dailyCardBenefits: string = '0';

  linkPaths: string[] = [
    '/daily-card-payments',
    '/daily-card-returns',
    '/daily-card-payments',
  ];
  summary: string[] = [
    'Paiement Carte Du Jour',
    'Retrait Carte Du Jour',
    'Benefice Carte Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/daily-reimbursement.png',
  ];

  today: string = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    const key = this.requestDateCorrectFormat; // NEW

    this.dailyCardPayments =
      this.auth.currentUser?.dailyCardPayments?.[key] ?? '0';
    this.dailyCardReturns =
      this.auth.currentUser?.dailyCardReturns?.[key] ?? '0';
    this.dailyCardBenefits =
      this.auth.currentUser?.dailyCardBenefits?.[key] ?? '0';
    this.summaryContent = [
      ` ${this.dailyCardPayments}`,
      ` ${this.dailyCardReturns}`,
      ` ${this.dailyCardBenefits}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyCardPayments
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyCardReturns)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyCardBenefits
      )}`,
    ];
  }
  // NEW – runs each time the user picks another day
  onDateChange() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );
    this.initalizeInputs(); // refresh all figures
  }
}
