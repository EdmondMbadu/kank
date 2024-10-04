import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
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
    this.dailyCardPayments =
      this.auth.currentUser.dailyCardPayments[this.today];
    this.dailyCardReturns = this.auth.currentUser.dailyCardReturns[this.today];
    this.dailyCardBenefits =
      this.auth.currentUser.dailyCardBenefits[this.today];
    this.dailyCardPayments =
      this.dailyCardPayments === undefined ? '0' : this.dailyCardPayments;
    this.dailyCardReturns =
      this.dailyCardReturns === undefined ? '0' : this.dailyCardReturns;
    this.dailyCardBenefits =
      this.dailyCardBenefits === undefined ? '0' : this.dailyCardBenefits;
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
}
