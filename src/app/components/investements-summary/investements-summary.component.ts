import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { DataService } from 'src/app/services/data.service';

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
    public compute: ComputationService,
    private data: DataService
  ) {}
  clients?: Client[];
  clientsWithoutDebt?: Client[];
  currentClients?: Client[] = [];
  currentClientsRegistered?: Client[] = [];
  // add with other booleans
  isOverviewOpen = true;

  // add a method near toggleOpen()
  toggleOverviewOpen() {
    this.isOverviewOpen = !this.isOverviewOpen;
  }

  async ngOnInit() {
    this.retrieveClients();

    this.updatePaymentGraphics(this.graphicPerformanceTimeRange);
    this.updateLendingGraphics(this.graphicTimeRangeLending);
    this.updatePerformanceGraphics(this.graphicPerformanceTimeRange);
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
  // public graph = {
  //   data: [{}],
  //   layout: {
  //     title: 'Paiment Journalier en $',
  //     xaxis: {
  //       title: 'Date',
  //       type: 'date', // Ensures the x-axis is treated as a time series
  //       tickformat: '%Y-%m-%d',
  //     },
  //     yaxis: {
  //       title: 'Date',

  //       tickprefix: '$',
  //     },
  //     barmode: 'stack',
  //     showlegend: false, // Optional: Hide legend for a cleaner look
  //     hovermode: 'x unified',
  //   },
  // };
  public graph2 = {
    data: [{}],
    layout: {
      title: 'Emprunts Journalier en $',
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

  isOpen = true;
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
    '/client-info-current',
    '/client-info',
    '/client-info-current',
    '/finished-debt',
    '/info-register',

    '/add-investment',

    '/client-info-current',
  ];
  imagePaths: string[] = [
    '../../../assets/img/debt.png',
    '../../../assets/img/people.svg',
    '../../../assets/img/people.svg',
    '../../../assets/img/people.svg',
    '../../../assets/img/people.svg',

    '../../../assets/img/invest.svg',

    '../../../assets/img/total-income.png',
  ];

  summary: string[] = [
    'Dette à Récupérer',
    'Nombres des Clients Total',
    'Nombres des Clients Actuel',
    'Nombres des Clients Sans Credit',
    'Nombres des Clients Enregistré',

    'Argent Investi',

    "Chiffre D'Affaire",
  ];
  summaryContent: string[] = [];
  sContent: string[] = [];

  toggleOpen() {
    this.isOpen = !this.isOpen;
  }
  initalizeInputs() {
    if (this.auth.currentUser) {
      let reserve =
        this.auth.currentUser.reserveAmount === undefined
          ? '0'
          : this.auth.currentUser.reserveAmount;
      let moneyHand =
        this.auth.currentUser.moneyInHands === undefined
          ? '0'
          : this.auth.currentUser.moneyInHands;
      let invested =
        this.auth.currentUser.amountInvested === undefined
          ? '0'
          : this.auth.currentUser.amountInvested;
      let dv = this.data.findTotalDebtLeft(this.clients!);
      let totalClientsLength = this.clients?.length;
      let debtTotal = dv === undefined ? '0' : dv;
      let cardM =
        this.auth.currentUser.cardsMoney === undefined
          ? '0'
          : this.auth.currentUser.cardsMoney;
      this.currentClients = [];
      let realBenefit = (Number(debtTotal) - Number(invested)).toString();
      let totalIncome = (
        Number(reserve) +
        Number(moneyHand) +
        Number(debtTotal) +
        Number(cardM)
      ).toString();
      this.summaryContent = [
        ` ${debtTotal}`,
        `${totalClientsLength}`,
        `${this.findClientsWithDebts()}`,
        `${this.findClientsWithoutDebts()}`,
        `${this.currentClientsRegistered?.length}`,

        ` ${invested}`,

        `${totalIncome}`,
      ];

      this.valuesConvertedToDollars = [
        `${this.compute.convertCongoleseFrancToUsDollars(debtTotal)}`,
        ``,
        ``,
        ``,
        ``,

        `${this.compute.convertCongoleseFrancToUsDollars(invested)}`,

        `${this.compute.convertCongoleseFrancToUsDollars(totalIncome)}`,
      ];

      if (!this.auth.isAdmninistrator) {
        this.summary = this.compute.filterOutElements(this.summary, 5);
      }
    }
  }

  findClientsWithDebts() {
    this.currentClientsRegistered = [];
    this.currentClients = [];
    if (this.clients) {
      this.currentClients = this.data.findClientsWithDebts(this.clients);
      const totalDebtLeft = this.currentClients.reduce(
        (sum, client) => sum + (Number(client.debtLeft) || 0),
        0
      );

      this.clients?.forEach((client) => {
        if (client.type !== undefined && client.type === 'register') {
          this.currentClientsRegistered?.push(client);
        }
      });
    }

    return this.currentClients?.length;
  }
  findClientsWithoutDebts() {
    this.clientsWithoutDebt = [];
    if (this.clients) {
      this.clients?.forEach((client) => {
        if (Number(client.debtLeft) === 0 && client.type !== 'register') {
          this.clientsWithoutDebt!.push(client);
        }
      });
    }
    return this.clientsWithoutDebt?.length;
  }
  findClientsWithoutDebtsButWithSavings() {
    this.clientsWithoutDebt = [];
    if (this.clients) {
      this.clients?.forEach((client) => {
        if (
          Number(client.debtLeft) === 0 &&
          Number(client.savings) > 0 &&
          client.type !== 'register'
        ) {
          this.clientsWithoutDebt!.push(client);
        }
      });
    }

    return this.clientsWithoutDebt?.length;
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

  updatePaymentGraphics(time: number) {
    let sorted = this.sortKeysAndValuesPayments(time);
    this.recentReimbursementDates = sorted[0];
    this.recentReimbursementAmounts = this.compute.convertToDollarsArray(
      sorted[1]
    );
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
            shape: 'spline',
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
  updatePerformanceGraphics(time: number) {
    let sorted = this.sortKeysAndValuesPerformance(time);
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
            shape: 'spline',
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

  updateLendingGraphics(time: number) {
    let sorted = this.sortKeysAndValuesLending(time);
    this.recentLendingDates = sorted[0];
    this.recentLendingAmounts = this.compute.convertToDollarsArray(sorted[1]);
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
            shape: 'spline',
            // width: 1200,
          },
        },
      ],
      layout: {
        title: 'Emprunts en $',
        barmode: 'stack',
      },
    };
  }
  isValidNumber(value: any): boolean {
    return value !== undefined && value !== null && !isNaN(value);
  }

  getValidNumber(value: any): number {
    return this.isValidNumber(value) ? value : 0;
  }
}
