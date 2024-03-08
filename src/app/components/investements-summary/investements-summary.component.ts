import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
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
  clients?: Client[];
  currentClients?: Client[] = [];
  ngOnInit() {
    this.retrieveClients();

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
  maxRangePerformance = this.auth.currentUser.performances.length;
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

  valuesConvertedToDollars: string[] = [];

  elements: number = 10;

  linkPath: string[] = [
    '/client-info',
    '/client-info-current',
    '/add-investment',
    '/client-info-current',
    '/client-info-current',
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/people.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/debt.png',
    '../../../assets/img/total-income.png',
  ];

  summary: string[] = [
    'Nombres des Clients Total',
    'Nombres des Clients Actuel',
    'Argent Investi',
    'Prêt Restant',

    "Chiffre D'Affaire",
  ];
  summaryContent: string[] = [];
  sContent: string[] = [];
  initalizeInputs() {
    let cardM =
      this.auth.currentUser.cardsMoney === undefined
        ? '0'
        : this.auth.currentUser.cardsMoney;
    this.currentClients = [];
    let realBenefit = (
      Number(this.auth.currentUser.totalDebtLeft) -
      Number(this.auth.currentUser.amountInvested)
    ).toString();
    let totalIncome = (
      Number(this.auth.currentUser.reserveAmount) +
      Number(this.auth.currentUser.moneyInHands) +
      Number(this.auth.currentUser.totalDebtLeft) +
      Number(cardM)
    ).toString();
    this.summaryContent = [
      `${this.auth.currentUser.numberOfClients}`,
      `${this.findClientsWithDebts()}`,
      ` ${this.auth.currentUser.amountInvested}`,
      ` ${this.auth.currentUser.totalDebtLeft}`,

      `${totalIncome}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.amountInvested
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.totalDebtLeft
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(totalIncome)}`,
    ];
  }
  findClientsWithDebts() {
    this.clients?.forEach((client) => {
      if (Number(client.debtLeft) > 0) {
        this.currentClients!.push(client);
      }
    });
    return this.currentClients?.length;
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.initalizeInputs();
    });
  }

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
      result.push(Math.floor(Number(a) * 0.00036));
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
