import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-tracking',
  templateUrl: './tracking.component.html',
  styleUrls: ['./tracking.component.css'],
})
export class TrackingComponent {
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
    '/client-info-current',
    '/client-info-current',
    '/add-expense',

    '/add-reserve',
    '/client-info-current',
  ];
  summary: string[] = [
    'Epargne Clients',
    'Argent en Main',
    'Depenses',

    'Reserve',
    'Benefice Réel',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/saving.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/expense.svg',

    '../../../assets/img/reserve.svg',

    '../../../assets/img/revenue.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    let realBenefit = (
      Number(this.auth.currentUser.totalDebtLeft) -
      Number(this.auth.currentUser.amountInvested)
    ).toString();

    let cardM =
      this.auth.currentUser.cardsMoney === undefined
        ? '0'
        : this.auth.currentUser.cardsMoney;
    let enMain = Number(this.auth.currentUser.moneyInHands) + Number(cardM);
    this.summaryContent = [
      ` ${this.auth.currentUser.clientsSavings}`,
      ` ${enMain}`,
      ` ${this.auth.currentUser.expensesAmount}`,

      ` ${this.compute.convertUsDollarsToCongoleseFranc(
        this.auth.currentUser.reserveAmountDollar
      )}`,

      `${realBenefit}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.clientsSavings
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(enMain.toString())}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.expensesAmount
      )}`,

      ` ${this.auth.currentUser.reserveAmountDollar}`,

      `${this.compute.convertCongoleseFrancToUsDollars(realBenefit)}`,
    ];

    // only show the first two
    if (!this.auth.isAdmninistrator) {
      this.summary = this.compute.filterOutElements(this.summary, 2);
    }
  }
}
