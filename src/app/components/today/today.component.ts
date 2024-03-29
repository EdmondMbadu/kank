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
  dailyFees: string = '0';
  dailyReserve: string = '0';

  totalPerfomance: number = 0;

  linkPaths: string[] = [
    '/not-paid-today',
    '/daily-payments',
    '/daily-lendings',
    '/client-info-current',
    '/add-reserve',
  ];
  summary: string[] = [
    "N'ont pas Payé Aujourdhui",
    'Paiement Du Jour',
    'Emprunt Du Jour',
    'Frais De Membre Du Jour',
    'Reserve Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/late-payment.png',
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/member.svg',
    '../../../assets/img/reserve.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    this.dailyLending = this.auth.currentUser.dailyLending[this.today];
    this.dailyPayment = this.auth.currentUser.dailyReimbursement[this.today];
    this.dailyFees = this.auth.currentUser.feesData[this.today];
    this.dailyReserve = this.compute
      .findTotalForToday(this.auth.currentUser.reserve)
      .toString();

    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;
    this.dailyFees = this.dailyFees === undefined ? '0' : this.dailyFees;
    this.dailyReserve =
      this.dailyReserve === undefined ? '0' : this.dailyReserve;
    this.summaryContent = [
      ``,
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
      ` ${this.dailyFees}`,
      ` ${this.dailyReserve}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyPayment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLending)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyFees)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyReserve)}`,
    ];
  }
}
