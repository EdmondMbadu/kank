import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-tracking-central',
  templateUrl: './tracking-central.component.html',
  styleUrls: ['./tracking-central.component.css'],
})
export class TrackingCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  allUsers: User[] = [];
  ngOnInit(): void {
    if (this.auth.isAdmin) {
      this.auth.getAllUsersInfo().subscribe((data) => {
        this.allUsers = data;
        this.initalizeInputs();
      });
    }
  }

  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/client-info-current',
    '/add-expense',
    '/add-reserve',
    '/client-info-current',
    '/client-info-current',
  ];
  summary: string[] = [
    'Epargne Clients',
    'Depenses',
    'Reserve',
    'Argent en Main',
    'Benefice Réel',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/saving.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/revenue.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    let savings = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'clientsSavings')
      .toString();
    let expenses = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'expensesAmount')
      .toString();
    let reserveDollar = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'reserveAmountDollar')
      .toString();
    let moneyHand = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'moneyInHands')
      .toString();
    let invested = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'amountInvested')
      .toString();
    let debtTotal = this.compute.findTotalAllUsersGivenField(
      this.allUsers,
      'totalDebtLeft'
    );
    let cardM = this.compute.findTotalAllUsersGivenField(
      this.allUsers,
      'cardsMoney'
    );
    console.log('total money in hands', moneyHand);
    console.log('reserveDollar', reserveDollar);
    // this.currentClients = [];
    let realBenefit = (Number(debtTotal) - Number(invested)).toString();

    let enMain = Number(moneyHand) + Number(cardM);
    this.summaryContent = [
      ` ${savings}`,
      ` ${expenses}`,
      ` ${this.compute.convertUsDollarsToCongoleseFranc(reserveDollar)}`,

      ` ${enMain}`,
      `${realBenefit}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(savings)}`,

      `${this.compute.convertCongoleseFrancToUsDollars(expenses)}`,
      ` ${reserveDollar}`,
      `${this.compute.convertCongoleseFrancToUsDollars(enMain.toString())}`,
      `${this.compute.convertCongoleseFrancToUsDollars(realBenefit)}`,
    ];
  }
}
