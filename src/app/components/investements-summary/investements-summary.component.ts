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
    this.updatePaymentGraphics();
    this.updateLendingGraphics();
    this.updatePieGrahics();
  }
  public graphPie = {
    data: [{}],
    layout: {
      title: 'Paiment Journalier en $',
      height: 400,
      width: 400,
      margin: { t: 0, b: 0, l: 0, r: 0 },
    },
  };
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

  maxRange = this.auth.currentUser.dailyReimbursement.length;

  totalPayGraphics: number = 0;
  totalLendingGraphics: number = 0;
  today = this.time.todaysDateMonthDayYear();
  colorPositive: string = '#008080';
  colorNegative: string = '#ff0000';
  week: number = 5;
  month: number = 20;
  day: number = 1;
  globalTime: number = this.week;
  graphicsPieTimeRange: number = this.week;
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
    '/paid-date',
    '/not-paid-today',
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
    '../../../assets/img/audit.png',
    '../../../assets/img/late-payment.png',
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
    'Paiement Du Jour',
    'Emprunt Du Jour',
    'Clients & Jour De Paiement',
    'Retracer Les Paiements',
    "N'ont pas Payé Aujourdhui",
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

  sortKeysAndValuesPayments(time: number) {
    const sortedKeys = Object.keys(this.auth.currentUser.dailyReimbursement)
      .sort((a, b) => +this.toDate(a) - +this.toDate(b))
      .slice(-time);
    const values = sortedKeys.map(
      (key) => this.auth.currentUser.dailyReimbursement[key]
    );
    return [sortedKeys, values];
  }
  sortKeysAndValuesLending(time: number) {
    const sortedKeys = Object.keys(this.auth.currentUser.dailyLending)
      .sort((a, b) => +this.toDate(a) - +this.toDate(b))
      .slice(-time);
    const values = sortedKeys.map(
      (key) => this.auth.currentUser.dailyLending[key]
    );
    return [sortedKeys, values];
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

  updatePaymentGraphics() {
    let sorted = this.sortKeysAndValuesPayments(this.graphicTimeRangePayment);
    this.recentReimbursementDates = sorted[0];
    this.recentReimbursementAmounts = this.convertToDollars(sorted[1]);
    const color1 = this.findColor(sorted[1]);
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
  }
  updatePieGrahics() {
    let sorted = this.sortKeysAndValuesPayments(this.graphicsPieTimeRange);
    this.totalPayGraphics = this.findSum(sorted[1]);
    let sorted2 = this.sortKeysAndValuesLending(this.graphicsPieTimeRange);
    this.totalLendingGraphics = this.findSum(sorted2[1]);
    console.log(
      'current payment, lending',
      this.totalPayGraphics,
      this.totalLendingGraphics
    );

    this.graphPie = {
      data: [
        {
          type: 'pie',
          values: [this.totalPayGraphics, this.totalLendingGraphics],
          labels: ['Paiments', 'Emprunts'],
          textposition: 'inside',
          hoverinfo: 'label+percent+name',
          hole: 0.4,
        },
      ],
      layout: {
        title: 'Emprunts vs Paiment',
        height: 400,
        width: 400,
        margin: { t: 0, b: 0, l: 0, r: 0 },
      },
    };
  }

  updateLendingGraphics() {
    let sorted = this.sortKeysAndValuesLending(this.graphicTimeRangeLending);
    this.recentLendingDates = sorted[0];
    this.recentLendingAmounts = this.convertToDollars(sorted[1]);
    const color2 = this.findColor(sorted[1]);
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

  findColor(array: string[]) {
    let start = Number(array[0]);
    let end = Number(array[array.length - 1]);
    return end - start >= 0 ? this.colorPositive : this.colorNegative;
  }
  findSum(array: string[]) {
    let total = 0;
    for (let a of array) {
      total += Number(a);
    }
    return total;
  }
}
