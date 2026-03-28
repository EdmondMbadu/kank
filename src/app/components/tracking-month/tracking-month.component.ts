import { Component } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

type TrackingMonthCard = {
  title: string;
  value: string;
  valueUsd: string;
  imagePath: string;
  linkPath?: string | null;
  subtitle?: string;
  isNegative?: boolean;
};

@Component({
  selector: 'app-tracking-month',
  templateUrl: './tracking-month.component.html',
  styleUrls: ['./tracking-month.component.css'],
})
export class TrackingMonthComponent {
  constructor(
    public auth: AuthService,
    public time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }

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
  givenMonthTotalPaymentAmount: string = '';
  givenMonthTotalBenefitAmount: string = '';
  givenMonthTotalLendingAmount: string = '';
  givenMonthTotalExpenseAmount: string = '';
  givenMonthTotalReserveAmount: string = '';
  givenMonthTotalFeesAmount: string = '';
  givenMonthTotalInvestmentAmount: string = '';
  givenMonthTotalLossAmount: string = '';
  monthlyCards: TrackingMonthCard[] = [];

  today = this.time.todaysDateMonthDayYear();
  initalizeInputs() {
    this.givenMonthTotalPaymentAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.dailyReimbursement,
      this.givenMonth,
      this.givenYear
    );

    this.givenMonthTotalBenefitAmount = Math.ceil(
      Number(this.givenMonthTotalPaymentAmount) * 0.285
    ).toString();

    this.givenMonthTotalLendingAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.dailyLending,
      this.givenMonth,
      this.givenYear
    );

    this.givenMonthTotalExpenseAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.expenses,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalLossAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.losses,
      this.givenMonth,
      this.givenYear
    );

    // the reserve amount per month is an approximation
    this.givenMonthTotalReserveAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.reserve,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalFeesAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.feesData,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalInvestmentAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.investments,
      this.givenMonth,
      this.givenYear
    );

    const entryExitAmount = (
      Number(this.givenMonthTotalReserveAmount) -
      Number(this.givenMonthTotalInvestmentAmount)
    ).toString();

    this.monthlyCards = [
      {
        title: 'Paiment Du Mois',
        value: this.givenMonthTotalPaymentAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalPaymentAmount
        )}`,
        imagePath: '../../../assets/img/audit.png',
        linkPath: '/paid-date',
      },
      {
        title: 'Emprunts Du Mois',
        value: this.givenMonthTotalLendingAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalLendingAmount
        )}`,
        imagePath: '../../../assets/img/lending-date.png',
        linkPath: '/lending-date',
      },
      {
        title: 'Benefice Du Mois ',
        value: this.givenMonthTotalBenefitAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalBenefitAmount
        )}`,
        imagePath: '../../../assets/img/benefit.svg',
        linkPath: '/client-info-current',
      },
      {
        title: 'Depense Du Mois',
        value: this.givenMonthTotalExpenseAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalExpenseAmount
        )}`,
        imagePath: '../../../assets/img/expense.svg',
        linkPath: '/add-expense',
      },
      {
        title: 'Reserve Du Mois',
        value: this.givenMonthTotalReserveAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalReserveAmount
        )}`,
        imagePath: '../../../assets/img/reserve.svg',
        linkPath: '/add-reserve',
      },
      {
        title: 'Frais De Membre Du Mois',
        value: this.givenMonthTotalFeesAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalFeesAmount
        )}`,
        imagePath: '../../../assets/img/member.svg',
        linkPath: '/client-info-current',
      },
      {
        title: 'Investissement Du Mois',
        value: this.givenMonthTotalInvestmentAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalInvestmentAmount
        )}`,
        imagePath: '../../../assets/img/invest.svg',
        linkPath: '/add-investment',
      },
      {
        title: 'Perte Du Mois',
        value: this.givenMonthTotalLossAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalLossAmount
        )}`,
        imagePath: '../../../assets/img/loss.png',
        linkPath: '/add-loss',
      },
      {
        title: 'Entrées / Sorties',
        subtitle: 'Reserve Du Mois - Investissement Du Mois',
        value: entryExitAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          entryExitAmount
        )}`,
        imagePath: '../../../assets/img/reserve.svg',
        isNegative: Number(entryExitAmount) < 0,
      },
    ];
  }
}
