import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-today-card-central',
  templateUrl: './today-card-central.component.html',
  styleUrls: ['./today-card-central.component.css'],
})
export class TodayCardCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}

  allUsers: User[] = [];

  requestDate: string = this.time.getTodaysDateYearMonthDay();
  selectedDateKey: string = this.time.todaysDateMonthDayYear();
  displayDate: string = this.time.convertDateToDayMonthYear(this.selectedDateKey);

  ngOnInit(): void {
    if (this.auth.isAdmin) {
      this.auth.getAllUsersInfo().subscribe((data) => {
        this.allUsers = data;
        this.initalizeInputs();
      });
    }
  }
  dailyCardPayments: string = '0';
  dailyCardReturns: string = '0';
  dailyCardBenefits: string = '0';

  linkPaths: string[] = ['/client-info-card', '/client-info-card'];
  summary: string[] = [
    'Paiement Carte Du Jour',
    'Retrait Carte Du Jour',
    'Benefice Carte Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/daily-reimbursement.png',
  ];

  summaryContent: string[] = [];
  initalizeInputs() {
    const dateKey = this.selectedDateKey;

    this.dailyCardPayments = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyCardPayments',
        dateKey
      )
      .toString();
    this.dailyCardReturns = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyCardReturns',
        dateKey
      )
      .toString();
    this.dailyCardBenefits = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyCardBenefits',
        dateKey
      )
      .toString();
    this.dailyCardPayments =
      this.dailyCardPayments === undefined ? '0' : this.dailyCardPayments;
    this.dailyCardReturns =
      this.dailyCardReturns === undefined ? '0' : this.dailyCardReturns;
    this.dailyCardBenefits =
      this.dailyCardBenefits === undefined ? '0' : this.dailyCardBenefits;
    this.summaryContent = [
      ` ${this.dailyCardPayments}`,
      ` ${this.dailyCardReturns}`,
      ` ${this.dailyCardBenefits}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyCardPayments
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyCardReturns)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyCardBenefits
      )}`,
    ];
  }

  onDateChange(date: string) {
    if (!date) {
      return;
    }
    this.requestDate = date;
    this.selectedDateKey = this.time.convertDateToMonthDayYear(date);
    this.displayDate = this.time.convertDateToDayMonthYear(
      this.selectedDateKey
    );

    if (this.allUsers.length) {
      this.initalizeInputs();
    }
  }
}
