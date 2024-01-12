import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

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
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }
  dailyLending: string = '0';
  dailyPayment: string = '0';

  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/daily-payments',
    '/daily-lendings',
    '/not-paid-today',
  ];
  summary: string[] = [
    'Paiement Du Jour',
    'Emprunt Du Jour',
    "N'ont pas Payé Aujourdhui",
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/late-payment.png',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    this.dailyLending = this.auth.currentUser.dailyLending[this.today];
    this.dailyPayment = this.auth.currentUser.dailyReimbursement[this.today];
    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;
    this.summaryContent = [` ${this.dailyPayment}`, ` ${this.dailyLending}`];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyPayment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLending)}`,
    ];
  }
}
