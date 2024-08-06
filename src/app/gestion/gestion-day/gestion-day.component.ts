import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-day',
  templateUrl: './gestion-day.component.html',
  styleUrls: ['./gestion-day.component.css'],
})
export class GestionDayComponent implements OnInit {
  managementInfo?: Management = {};
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit(): void {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.initalizeInputs();
      this.updateReserveGraphics();
    });
  }
  week: number = 5;
  month: number = 20;
  day: number = 1;
  graphicsRange: number = this.week;
  maxRange = 0;
  recentReserveDates: string[] = [];
  recentReserveAmounts: number[] = [];
  dailyExpense: string = '0';
  dailyBankFranc: string = '0';
  dailyBankDollar: string = '0';
  dailyServed: string = '0';
  dailyLoss: string = '0';
  dollarLoss: string = '0';
  dailyReserve: string = '0';
  dailyInvestment: string = '0';
  public graph = {
    data: [{}],
    layout: {
      title: 'Paiment Journalier en $',
      barmode: 'stack',
    },
  };

  moneyInHands: string = '0';

  totalPerfomance: number = 0;

  linkPaths: string[] = [
    '/gestion-reserve',
    '/gestion-today',
    '/gestion-expenses',
    '/gestion-served',
    '/gestion-bank',
    '/gestion-loss',
    '/gestion-investment',
  ];
  summary: string[] = [
    'Reserve Du Jour',
    'Argent En Main',
    'Depense Du Jour',
    'Argent A Servir',
    'Argent En Banque Du Jour',
    'Perte Du Jour',
    'Investissement Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/reserve.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/expense.svg',
    '../../../assets/img/serve-money.png',
    '../../../assets/img/bank.png',
    '../../../assets/img/loss.png',
    '../../../assets/img/invest.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  summaryContent: string[] = [];
  initalizeInputs() {
    console.log('management info', this.managementInfo);

    this.dailyReserve = this.compute
      .findTotalForToday(
        this.managementInfo?.reserve!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyExpense = this.compute
      .findTotalForToday(
        this.managementInfo?.expenses!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyServed = this.compute
      .findTotalForToday(
        this.managementInfo?.moneyGiven!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dollarLoss = this.compute
      .findTotalForToday(
        this.managementInfo?.dollarTransferLoss!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyBankFranc = this.compute
      .findTotalForToday(
        this.managementInfo?.bankDepositFrancs!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyBankDollar = this.compute
      .findTotalForToday(
        this.managementInfo?.bankDepositDollars!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyLoss = this.compute
      .findTotalForToday(
        this.managementInfo?.exchangeLoss!,
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyInvestment = this.compute
      .findTotalForToday(
        this.managementInfo?.investment!,
        this.requestDateCorrectFormat
      )
      .toString();

    if (this.auth.managementInfo.reserve !== undefined)
      this.maxRange = this.auth.managementInfo.reserve.length;

    this.dailyBankFranc =
      this.dailyBankFranc === undefined ? '0' : this.dailyBankFranc;
    this.dailyInvestment =
      this.dailyInvestment === undefined ? '0' : this.dailyInvestment;
    this.dollarLoss = this.dollarLoss === undefined ? '0' : this.dollarLoss;
    this.dailyBankDollar =
      this.dailyBankDollar === undefined ? '0' : this.dailyBankDollar;
    this.dailyReserve =
      this.dailyReserve === undefined ? '0' : this.dailyReserve;
    this.dailyExpense =
      this.dailyExpense === undefined ? '0' : this.dailyExpense;
    this.dailyLoss = this.dailyLoss === undefined ? '0' : this.dailyLoss;
    this.dailyServed = this.dailyServed === undefined ? '0' : this.dailyServed;
    this.moneyInHands =
      this.managementInfo?.moneyInHands === undefined
        ? '0'
        : this.managementInfo?.moneyInHands;
    let dloss = (
      Number(this.compute.convertUsDollarsToCongoleseFranc(this.dollarLoss)) +
      Number(this.dailyLoss)
    ).toString();
    this.summaryContent = [
      ` ${this.dailyReserve}`,
      `${this.moneyInHands}`,
      `${this.dailyExpense}`,
      `${this.dailyServed}`,
      `${this.dailyBankFranc}`,
      `${dloss}`,
      `${this.dailyInvestment}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyReserve)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.moneyInHands)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyExpense)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyServed)}`,
      `${this.dailyBankDollar}`,
      `${this.compute.convertCongoleseFrancToUsDollars(dloss)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyInvestment)}`,
    ];
  }

  findDailyActivitiesAmount() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    console.log('date', this.requestDateCorrectFormat);
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );

    this.initalizeInputs();
  }
  updateReserveGraphics() {
    let sorted = this.sortKeysAndValuesReserve(this.graphicsRange);
    this.recentReserveDates = sorted[0];
    this.recentReserveAmounts = this.compute.convertToDollarsArray(sorted[1]);
    const color1 = this.compute.findColor(sorted[1]);
    this.graph = {
      data: [
        {
          x: this.recentReserveDates,
          y: this.recentReserveAmounts,
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
  sortKeysAndValuesReserve(time: number): [string[], string[]] {
    const dailyReimbursement = this.auth.managementInfo.reserve;

    // Aggregating values by day
    const aggregatedData: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(dailyReimbursement)) {
      const day = key.split('-').slice(0, 3).join('-'); // Extracting the date part
      const numericValue = parseFloat(value as string); // Type assertion
      if (aggregatedData[day]) {
        aggregatedData[day] += numericValue;
      } else {
        aggregatedData[day] = numericValue;
      }
    }

    // Sorting and slicing
    const sortedKeys = Object.keys(aggregatedData)
      .sort((a, b) => +new Date(a) - +new Date(b))
      .slice(-time);
    const values = sortedKeys.map((key) => aggregatedData[key].toString());

    return [sortedKeys, values];
  }
}
