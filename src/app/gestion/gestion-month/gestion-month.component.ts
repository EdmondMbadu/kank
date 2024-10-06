import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-month',
  templateUrl: './gestion-month.component.html',
  styleUrls: ['./gestion-month.component.css'],
})
export class GestionMonthComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    public time: TimeService,
    public compute: ComputationService
  ) {}
  ngOnInit() {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.initalizeInputs();
      this.updateReserveGraphics(this.graphicsRange);
    });
  }
  week: number = 4;
  mTime = 8;
  day: number = 1;
  graphicsRange: number = this.week;
  graphicsRangeServe: number = this.week;
  maxRange = 0;
  public graph = {
    data: [{}],
    layout: {
      title: 'Reserve Journalier en $',
      barmode: 'stack',
    },
  };
  managementInfo?: Management = {};
  recentReserveDates: string[] = [];
  recentReserveAmounts: number[] = [];
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  yearsList: number[] = this.time.yearsList;
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  monthYear = `${this.month} ${this.year}`;
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
    'Pourcentage Perte Du Mois',
    'Reserve Du Mois',
    'Argent En Main',
    'Depense Du Mois',
    'Argent Servi Mois',
    'Argent En Banque Du Mois',
    'Perte Du Du Mois',
    'Investissement Du Mois',
  ];
  valuesConvertedToDollars: string[] = [];

  givenMonthTotalReserveAmount: string = '';
  moneyInHands: string = '';
  givenMonthTotalExpenseAmount: string = '';
  givenMonthTotalServedAmount: string = '';
  givenMonthTotalBankAmountFrancs: string = '';
  givenMonthTotalBankAmountDollar: string = '';
  givenMonthTotalLossAmountDollar: string = '';
  givenMonthTotalLossAmount: string = '';
  givenMonthTotalInvestmentAmount: string = '';

  imagePaths: string[] = [
    '../../../assets/img/loss-ratio.png',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/expense.svg',
    '../../../assets/img/serve-money.png',
    '../../../assets/img/bank.png',
    '../../../assets/img/loss.png',
    '../../../assets/img/invest.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  lossRatio: number = 0;
  initalizeInputs() {
    this.givenMonthTotalReserveAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.reserve!,
      this.givenMonth,
      this.givenYear
    );

    this.moneyInHands = this.managementInfo?.moneyInHands!;

    this.givenMonthTotalExpenseAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.expenses!,
      this.givenMonth,
      this.givenYear
    );

    // the reserve amount per month is an approximation
    this.givenMonthTotalExpenseAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.expenses!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalServedAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.moneyGiven!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalBankAmountFrancs = this.compute.findTotalGiventMonth(
      this.managementInfo?.bankDepositFrancs!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalBankAmountDollar = this.compute.findTotalGiventMonth(
      this.managementInfo?.bankDepositDollars!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalLossAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.exchangeLoss!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalLossAmountDollar = this.compute.findTotalGiventMonth(
      this.managementInfo?.dollarTransferLoss!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalInvestmentAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.investment!,
      this.givenMonth,
      this.givenYear
    );
    let totalLoss = (
      Number(this.givenMonthTotalLossAmount) +
      Number(
        this.compute.convertUsDollarsToCongoleseFranc(
          this.givenMonthTotalLossAmountDollar
        )
      )
    ).toString();
    this.lossRatio =
      Math.ceil(
        (Number(totalLoss) / Number(this.givenMonthTotalReserveAmount)) * 10000
      ) / 100;
    this.summaryContent = [
      `${this.lossRatio}`,
      `${this.givenMonthTotalReserveAmount}`,
      `${this.moneyInHands}`,
      `${this.givenMonthTotalExpenseAmount}`,
      `${this.givenMonthTotalServedAmount}`,
      `${this.givenMonthTotalBankAmountFrancs}`,
      `${totalLoss}`,
      `${this.givenMonthTotalInvestmentAmount}`,
    ];
    this.valuesConvertedToDollars = [
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalReserveAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.moneyInHands)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalExpenseAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalServedAmount
      )}`,
      `${this.givenMonthTotalBankAmountDollar}`,
      `${this.compute.convertCongoleseFrancToUsDollars(totalLoss)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalInvestmentAmount
      )}`,
    ];
  }

  updateReserveGraphics(time: number) {
    let sorted = this.sortKeysAndValuesReserve(time);

    this.recentReserveDates = sorted[0];
    this.recentReserveAmounts = this.compute.convertToDollarsArray(sorted[1]);
    const color1 = this.compute.findColor(sorted[1]);
    this.graph = {
      data: [
        {
          x: this.recentReserveDates,
          y: this.recentReserveAmounts,
          type: 'bar',
          mode: 'lines',
          marker: { color: color1 },
          line: {
            color: 'rgb(34, 139, 34)',
            // width: 1200,
          },
        },
      ],
      layout: {
        title: 'Reserve en $',
        barmode: 'stack',
      },
    };
  }

  sortKeysAndValuesReserve(time: number): [string[], string[]] {
    const dailyReimbursement = this.auth.managementInfo.reserve;

    // Aggregating values by month (MM-YYYY)
    const aggregatedData: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(dailyReimbursement)) {
      const [month, day, year] = key.split('-');
      const monthYear = `${month}-${year}`; // Create MM-YYYY format

      const numericValue = parseFloat(value as string); // Convert value to number
      if (aggregatedData[monthYear]) {
        aggregatedData[monthYear] += numericValue; // Aggregate values
      } else {
        aggregatedData[monthYear] = numericValue; // Initialize if not present
      }
    }

    // Sorting the keys in chronological order and limiting the results to the last `time` months
    const sortedKeys = Object.keys(aggregatedData)
      .sort((a, b) => {
        const [monthA, yearA] = a.split('-');
        const [monthB, yearB] = b.split('-');
        return (
          new Date(`${yearA}-${monthA}-01`).getTime() -
          new Date(`${yearB}-${monthB}-01`).getTime()
        );
      })
      .slice(-time);

    // Mapping the sorted keys to their corresponding values
    const values = sortedKeys.map((key) => aggregatedData[key].toString());

    return [sortedKeys, values];
  }
}
