import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
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
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }

  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/client-info',
    '/add-expense',
    '/add-reserve',
    '/client-info',
  ];
  summary: string[] = [
    'Epargne Clients',
    'Depenses',
    'Reserve',
    'Argent en Main',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/saving.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/salary.png',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    this.summaryContent = [
      ` ${this.auth.currentUser.clientsSavings}`,
      ` ${this.auth.currentUser.expensesAmount}`,
      ` ${this.auth.currentUser.reserveAmount}`,

      ` ${this.auth.currentUser.moneyInHands}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.clientsSavings
      )}`,

      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.expensesAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.reserveAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.auth.currentUser.moneyInHands
      )}`,
    ];
  }
}
