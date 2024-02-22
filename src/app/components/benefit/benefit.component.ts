import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-benefit',
  templateUrl: './benefit.component.html',
  styleUrls: ['./benefit.component.css'],
})
export class BenefitComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }

  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/team-page',
    '/team-page',
    '/client-info-current',
    '/client-info-current',
  ];
  summary: string[] = [
    "Performance D'Aujourdhui",
    'Performance Globale',
    'Frais Des Membres',
    'Benefice Brute',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/performance.png',
    '../../../assets/img/performance-global.png',
    '../../../assets/img/member.svg',
    '../../../assets/img/benefit.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    let realBenefit = (
      Number(this.auth.currentUser.totalDebtLeft) -
      Number(this.auth.currentUser.amountInvested)
    ).toString();

    let bWithoutExpenses = this.BenefitsWithoutExpenses();

    let performance =
      this.auth.currentUser.performances[this.today] === undefined
        ? ''
        : this.auth.currentUser.performances[this.today];

    this.sumPerformance();

    this.summaryContent = [
      performance,
      this.totalPerfomance,
      ` ${this.auth.currentUser.fees}`,
      `${bWithoutExpenses}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      ``,

      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.fees
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(bWithoutExpenses)}`,
    ];
  }

  BenefitsWithoutExpenses(): string {
    const benefit =
      Number(this.auth.currentUser.projectedRevenue) -
      Number(this.auth.currentUser.amountLended);

    return benefit.toString();
  }

  sumPerformance() {
    this.totalPerfomance = 0;
    for (let key in this.auth.currentUser.performances) {
      this.totalPerfomance += parseFloat(
        this.auth.currentUser.performances[key]
      );
    }
  }
}
