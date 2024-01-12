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
    this.updatePerformanceGraphics();
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
  public graphPerformance = {
    data: [{}],
    layout: {
      title: 'Performance Points',
      barmode: 'stack',
    },
  };

  maxRange = this.auth.currentUser.dailyReimbursement.length;
  totalPayGraphics: number = 0;
  totalLendingGraphics: number = 0;
  today = this.time.todaysDateMonthDayYear();

  week: number = 5;
  month: number = 20;
  day: number = 1;
  totalPerfomance: number = 0;
  globalTime: number = this.week;
  graphicsPieTimeRange: number = this.week;
  graphicTimeRangePayment: number = this.week;
  graphicTimeRangeLending: number = this.week;
  graphicPerformanceTimeRange: number = this.week;
  recentReimbursementDates: string[] = [];
  recentReimbursementAmounts: number[] = [];
  recentLendingDates: string[] = [];
  recentLendingAmounts: number[] = [];
  recentPerformanceDates: string[] = [];
  recentPerformanceNumbers: number[] = [];
  dailyLending: string = '0';
  dailyPayment: string = '0';
  valuesConvertedToDollars: string[] = [];
  vDollars: string[] = [];
  elements: number = 10;
  linkPath: string[] = [
    '/client-info',
    '/team-page',
    '/team-page',
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
    '/lending-date',
    '/not-paid-today',
    '/not-paid',
  ];
  lPath: string[] = [
    '/client-info',
    '/add-investment',
    '/client-info',
    '/client-info',
  ];
  iPath: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/debt.png',
    '../../../assets/img/revenue.svg',
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/performance.png',
    '../../../assets/img/performance-global.png',
    '../../../assets/img/invest.svg',
    '../../../assets/img/debt.png',
    '../../../assets/img/saving.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/revenue.svg',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/member.svg',
    '../../../assets/img/benefit.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/calendar.png',
    '../../../assets/img/audit.png',
    '../../../assets/img/lending-date.png',
    '../../../assets/img/late-payment.png',
    '../../../assets/img/payment-method.png',
  ];
  summary: string[] = [
    'Nombres des Clients',
    "Performance D'Aujourdhui",
    'Performance Globale',
    'Argent Investi',
    'Prêt Restant',
    'Epargne Clients',
    'Depenses',
    'Benefice Réel',
    'Reserve',
    'Frais Des Membres',
    'Benefice Brute',
    'Argent en Main',
    'Paiement Du Jour',
    'Emprunt Du Jour',
    'Clients & Jour De Paiement',
    'Retracer Les Paiements',
    'Retracer Les Emprunts ',
    "N'ont pas Payé Aujourdhui",
    "N'ont pas Payé",
  ];
  sm: string[] = [
    'Nombres des Clients',
    'Argent Investi',
    'Prêt Restant',
    'Benefice Réel',
  ];
  summaryContent: string[] = [];
  sContent: string[] = [];
  initalizeInputs() {
    let realBenefit = (
      Number(this.auth.currentUser.totalDebtLeft) -
      Number(this.auth.currentUser.amountInvested)
    ).toString();
    let bWithExpenses = this.BenefitsWithExpenses();
    let bWithoutExpenses = this.BenefitsWithoutExpenses();
    this.dailyLending = this.auth.currentUser.dailyLending[this.today];
    let performance =
      this.auth.currentUser.performances[this.today] === undefined
        ? ''
        : this.auth.currentUser.performances[this.today];
    this.dailyPayment = this.auth.currentUser.dailyReimbursement[this.today];
    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;
    this.sumPerformance();

    this.summaryContent = [
      this.auth.currentUser.numberOfClients,
      performance,
      this.totalPerfomance,
      ` ${this.auth.currentUser.amountInvested}`,
      ` ${this.auth.currentUser.totalDebtLeft}`,
      ` ${this.auth.currentUser.clientsSavings}`,
      ` ${this.auth.currentUser.expensesAmount}`,
      `${realBenefit}`,
      ` ${this.auth.currentUser.reserveAmount}`,
      ` ${this.auth.currentUser.fees}`,
      `${bWithoutExpenses}`,
      ` ${this.auth.currentUser.moneyInHands}`,
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
    ];
    this.sContent = [
      this.auth.currentUser.numberOfClients,
      ` ${this.auth.currentUser.amountInvested}`,
      ` ${this.auth.currentUser.totalDebtLeft}`,
      `${realBenefit}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      ``,
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
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.moneyInHands
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyPayment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLending)}`,
    ];
    this.vDollars = [
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.amountInvested
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.totalDebtLeft
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(realBenefit)}`,
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

  sumPerformance() {
    this.totalPerfomance = 0;
    for (let key in this.auth.currentUser.performances) {
      this.totalPerfomance += parseFloat(
        this.auth.currentUser.performances[key]
      );
    }
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
  sortKeysAndValuesPerformance(time: number) {
    const sortedKeys = Object.keys(this.auth.currentUser.performances)
      .sort((a, b) => +this.toDate(a) - +this.toDate(b))
      .slice(-time);
    const values = sortedKeys.map(
      (key) => this.auth.currentUser.performances[key]
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
    const color1 = this.compute.findColor(sorted[1]);
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
  updatePerformanceGraphics() {
    let sorted = this.sortKeysAndValuesPerformance(
      this.graphicPerformanceTimeRange
    );
    this.recentPerformanceDates = sorted[0];
    this.recentPerformanceNumbers = this.compute.convertToNumbers(sorted[1]);
    const color = this.compute.findColor(sorted[1]);

    this.graphPerformance = {
      data: [
        {
          x: this.recentPerformanceDates,
          y: this.recentPerformanceNumbers,
          type: 'scatter',
          mode: 'lines',
          marker: { color: 'rgb(0,76,153)' },
          line: {
            color: color,
            // width: 1200,
          },
        },
      ],
      layout: {
        title: 'Performance Points',
        barmode: 'stack',
      },
    };
  }

  updatePieGrahics() {
    let sorted = this.sortKeysAndValuesPayments(this.graphicsPieTimeRange);
    this.totalPayGraphics = this.compute.findSum(sorted[1]);

    let sorted2 = this.sortKeysAndValuesLending(this.graphicsPieTimeRange);
    this.totalLendingGraphics = this.compute.findSum(sorted2[1]);

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
        height: 300,
        width: 300,
        margin: { t: 0, b: 0, l: 0, r: 0 },
      },
    };
  }

  updateLendingGraphics() {
    let sorted = this.sortKeysAndValuesLending(this.graphicTimeRangeLending);
    this.recentLendingDates = sorted[0];
    this.recentLendingAmounts = this.convertToDollars(sorted[1]);
    const color2 = this.compute.findColor(sorted[1]);
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
}
