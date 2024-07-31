import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
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
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.initalizeInputs();
    });
  }
  managementInfo?: Management = {};
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
    this.summaryContent = [
      `${this.givenMonthTotalReserveAmount}`,
      `${this.moneyInHands}`,
      `${this.givenMonthTotalExpenseAmount}`,
      `${this.givenMonthTotalServedAmount}`,
      `${this.givenMonthTotalBankAmountFrancs}`,
      `${totalLoss}`,
      `${this.givenMonthTotalInvestmentAmount}`,
    ];
    this.valuesConvertedToDollars = [
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
      `${this.givenMonthTotalBankAmountDollar}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalInvestmentAmount
      )}`,
    ];
  }
}
