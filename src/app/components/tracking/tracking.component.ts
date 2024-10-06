import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
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
    private compute: ComputationService,
    private data: DataService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }

  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/client-info-current',
    '/client-info-current',
    '/tracking',
    '/add-expense',

    '/add-reserve',
    '/client-info-current',
  ];
  summary: string[] = [
    'Epargne Clients',
    'Argent en Main',
    'Budget Emprunts Du Mois',
    'Budget Emprunts Du Mois En Attente',
    'Depenses',

    'Reserve',
    'Benefice Réel',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/saving.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/budget.png',
    '../../../assets/img/budget.png',

    '../../../assets/img/expense.svg',

    '../../../assets/img/reserve.svg',

    '../../../assets/img/revenue.svg',
  ];

  today = this.time.todaysDateMonthDayYear();

  monthBudget: string = '';
  amountBudget: string = '';
  amountBudgetPending: string = '';
  summaryContent: string[] = [];
  initalizeInputs() {
    let realBenefit = (
      Number(this.auth.currentUser.totalDebtLeft) -
      Number(this.auth.currentUser.amountInvested)
    ).toString();
    this.monthBudget =
      this.auth.currentUser.monthBudget === ''
        ? '0'
        : this.auth.currentUser.monthBudget;
    this.amountBudgetPending =
      this.auth.currentUser.monthBudgetPending === ''
        ? '0'
        : this.auth.currentUser.monthBudgetPending;
    let cardM =
      this.auth.currentUser.cardsMoney === undefined
        ? '0'
        : this.auth.currentUser.cardsMoney;
    let enMain = Number(this.auth.currentUser.moneyInHands) + Number(cardM);
    this.summaryContent = [
      ` ${this.auth.currentUser.clientsSavings}`,
      ` ${enMain}`,
      `${this.monthBudget}`,
      `${this.amountBudgetPending}`,
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
      `${this.compute.convertCongoleseFrancToUsDollars(this.monthBudget)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.amountBudgetPending
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.expensesAmount
      )}`,

      ` ${this.auth.currentUser.reserveAmountDollar}`,

      `${this.compute.convertCongoleseFrancToUsDollars(realBenefit)}`,
    ];

    // only show the first two
    if (!this.auth.isAdmninistrator) {
      this.summary = this.compute.filterOutElements(this.summary, 3);
    }
  }

  async setMonthBudget() {
    if (!this.isNumber(this.amountBudget)) {
      alert('Enter a valid number');
      return;
    }
    try {
      const clientCardPayment = await this.auth.setMonthBudget(
        this.amountBudget
      );
      this.monthBudget = this.amountBudget;
      this.initalizeInputs();
    } catch (err) {
      alert("Une erreur s'est produite lors du placement du budget, Réessayez");
      return;
    }
  }
  async setMonthBudgetPending() {
    if (!this.isNumber(this.amountBudgetPending)) {
      alert('Enter a valid number');
      return;
    }
    try {
      const clientCardPayment = await this.auth.setMonthBudgetPending(
        this.amountBudgetPending
      );
      this.initalizeInputs();
    } catch (err) {
      alert("Une erreur s'est produite lors du placement du budget, Réessayez");
      return;
    }
  }
  isNumber(value: string): boolean {
    return !isNaN(Number(value));
  }
}
