import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-investements-summary',
  templateUrl: './investements-summary.component.html',
  styleUrls: ['./investements-summary.component.css'],
})
export class InvestementsSummaryComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
    this.extractValues();
  }
  public graph = {
    data: [{}],
    layout: {
      title: 'Paiment Journalier en $',
      barmode: 'stack',
    },
  };
  public graph2 = {
    data: [{}],
    layout: {
      title: 'Paiment Journalier en $',
      barmode: 'stack',
    },
  };

  today = this.time.todaysDateMonthDayYear();
  colorPositive: string = '#008080';
  colorNegative: string = '#ff0000';
  week: number = 5;
  month: number = 20;
  day: number = 1;
  graphicTimeRangePayment: number = this.week;
  graphicTimeRangeLending: number = this.week;
  recentReimbursementDates: string[] = [];
  recentReimbursementAmounts: number[] = [];
  recentLendingDates: string[] = [];
  recentLendingAmounts: number[] = [];
  dailyLending: string = '0';
  dailyPayment: string = '0';
  valuesConvertedToDollars: string[] = [];
  elements: number = 10;
  linkPath: string[] = [
    '/client-info',
    '/add-investment',
    '/client-info',
    '/client-info',
    '/add-expense',
    '/client-info',
    '/add-reserve',
    '/client-info',
    '/client-info',
    '/client-info',
    '/daily-payments',
    '/daily-lendings',
    '/pay-today',
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/debt.png',
    '../../../assets/img/saving.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/revenue.svg',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/member.svg',
    '../../../assets/img/benefit.svg',
    '../../../assets/img/benefit.svg',
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/calendar.png',
  ];
  summary: string[] = [
    'Nombres des Clients',
    'Argent Investi',
    'Prêt Restant',
    'Epargne Clients',
    'Depenses',
    'Benefice Réel',
    'Reserve',
    'Frais Des Membres',
    'Benefice Brute',
    'Benefice',
    'Paiment Du Jour',
    'Emprunt Du Jour',
    'Clients & Jour De Payment',
  ];
  summaryContent: string[] = [];

  initalizeInputs() {
    let realBenefit = (
      Number(this.auth.currentUser.totalDebtLeft) -
      Number(this.auth.currentUser.amountInvested)
    ).toString();
    let bWithExpenses = this.BenefitsWithExpenses();
    let bWithoutExpenses = this.BenefitsWithoutExpenses();
    this.dailyLending = this.auth.currentUser.dailyLending[this.today];
    this.dailyPayment = this.auth.currentUser.dailyReimbursement[this.today];
    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;

    this.summaryContent = [
      this.auth.currentUser.numberOfClients,
      ` ${this.auth.currentUser.amountInvested}`,
      ` ${this.auth.currentUser.totalDebtLeft}`,
      ` ${this.auth.currentUser.clientsSavings}`,
      ` ${this.auth.currentUser.expensesAmount}`,
      `${realBenefit}`,
      ` ${this.auth.currentUser.reserveAmount}`,
      ` ${this.auth.currentUser.fees}`,
      `${bWithoutExpenses}`,
      ` ${bWithExpenses}`,
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.amountInvested
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.totalDebtLeft
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.clientsSavings
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.expensesAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(realBenefit)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.reserveAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.fees
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(bWithoutExpenses)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(bWithExpenses)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyPayment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLending)}`,
    ];
  }
  BenefitsWithExpenses(): string {
    const benefit =
      Number(this.auth.currentUser.projectedRevenue) -
      Number(this.auth.currentUser.amountLended) -
      Number(this.auth.currentUser.expensesAmount) -
      Number(this.auth.currentUser.reserveAmount);
    return benefit.toString();
  }
  BenefitsWithoutExpenses(): string {
    const benefit =
      Number(this.auth.currentUser.projectedRevenue) -
      Number(this.auth.currentUser.amountLended);

    return benefit.toString();
  }

  displayGraph() {}

  extractValues() {
    const sortedKeys = Object.keys(this.auth.currentUser.dailyReimbursement)
      .sort((a, b) => +this.toDate(a) - +this.toDate(b))
      .slice(-this.graphicTimeRangePayment);
    const values = sortedKeys.map(
      (key) => this.auth.currentUser.dailyReimbursement[key]
    );
    const color1 = this.findColor(values);
    this.recentReimbursementDates = sortedKeys;
    this.recentReimbursementAmounts = this.convertToDollars(values);
    const sortedKeys2 = Object.keys(this.auth.currentUser.dailyLending)
      .sort((a, b) => +this.toDate(a) - +this.toDate(b))
      .slice(-this.graphicTimeRangeLending);
    const values2 = sortedKeys2.map(
      (key) => this.auth.currentUser.dailyLending[key]
    );
    this.recentLendingDates = sortedKeys2;
    this.recentLendingAmounts = this.convertToDollars(values2);
    const color2 = this.findColor(values2);

    this.graph = {
      data: [
        {
          x: this.recentReimbursementDates,
          y: this.recentReimbursementAmounts,
          type: 'scatter',
          mode: 'lines',
          marker: { color: 'rgb(0,76,153)' },
          line: {
            color: color1,
            // width: 1200,
          },
        },
      ],
      layout: {
        title: 'Paiment en $',
        barmode: 'stack',
      },
    };
    this.graph2 = {
      data: [
        {
          x: this.recentLendingDates,
          y: this.recentLendingAmounts,
          type: 'scatter',
          mode: 'lines+points',
          marker: { color: 'rgb(0,153,0)' },
          line: {
            color: color2,
            // width: 1200,
          },
        },
      ],
      layout: {
        title: 'Paiment en $',
        barmode: 'stack',
      },
    };
  }

  toDate(dateString: string) {
    const [month, day, year] = dateString
      .split('-')
      .map((part: any) => parseInt(part, 10));
    return new Date(year, month - 1, day);
  }

  convertToDollars(array: any) {
    let result: number[] = [];
    for (let a of array) {
      result.push(Math.floor(Number(a) * 0.0004));
    }

    return result;
  }
  updateGraphicTimeRange() {
    this.extractValues();
  }

  findColor(array: string[]) {
    let start = Number(array[0]);
    let end = Number(array[array.length - 1]);
    return end - start >= 0 ? this.colorPositive : this.colorNegative;
  }
}
