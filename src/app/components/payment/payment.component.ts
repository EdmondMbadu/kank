import { Component } from '@angular/core';
import { isFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css'],
})
export class PaymentComponent {
  id: any = '';
  today = this.time.todaysDateMonthDayYear();
  paymentOtherAmount: boolean = false;
  savingsOtherAmount: boolean = false;
  savingsAmount: string = '';
  paymentAmount: string = '';
  numberOfPaymentToday = 0;
  client: Client = new Client();
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private time: TimeService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      this.numberOfPaymentToday = this.howManyTimesPaidToday();
    });
  }
  displaySavingsOtherAmount() {
    if (this.savingsAmount === 'Other Amount') {
      this.savingsOtherAmount = true;
      this.savingsAmount = '';
    } else {
      this.savingsOtherAmount = false;
    }
  }
  displayPaymentOtherAmount() {
    console.log('payment amount', this.paymentAmount);
    if (this.paymentAmount === 'Other Amount') {
      this.paymentOtherAmount = true;
      this.paymentAmount = '';
    } else {
      this.paymentOtherAmount = false;
    }
  }

  makePayment() {
    if (this.paymentAmount === '' || this.savingsAmount === '') {
      alert('FIll all fields');
      return;
    } else if (
      Number.isNaN(Number(this.paymentAmount)) ||
      Number.isNaN(Number(this.savingsAmount))
    ) {
      alert('Incorrect input. Enter a number');
      return;
    } else if (
      Number(this.paymentAmount) < 0 ||
      Number(this.savingsAmount) < 0
    ) {
      alert('The numbers must be positive');
      return;
    } else if (
      Number(this.paymentAmount) <= 0 &&
      Number(this.savingsAmount) <= 0
    ) {
      alert('At least one number must be greater than 0');
      return;
    } else {
      let conf = confirm(
        `You have made ${this.numberOfPaymentToday} payment(s) today. Do you still want to proceed?`
      );
      if (!conf) {
        return;
      }
      this.client.amountPaid = (
        Number(this.client.amountPaid) + Number(this.paymentAmount)
      ).toString();
      this.client.numberOfPaymentsMade = (
        Number(this.client.numberOfPaymentsMade) + 1
      ).toString();
      this.client.creditScore = (
        Number(this.client.creditScore) + this.computeCreditScore()
      ).toString();
      this.client.numberOfPaymentsMissed = Math.max(
        0,
        this.time.weeksSince(this.client.dateJoined!) -
          Number(this.client.numberOfPaymentsMade)
      ).toString();

      this.client.payments = { [this.time.todaysDate()]: this.paymentAmount };
      if (this.savingsAmount !== '0') {
        this.client.savings = (
          Number(this.client.savings) + Number(this.savingsAmount)
        ).toString();
        this.client.savingsPayments = {
          [this.time.todaysDate()]: this.savingsAmount,
        };
      }
      this.client.debtLeft = (
        Number(this.client.amountToPay) - Number(this.client.amountPaid)
      ).toString();
    }
    let date = this.time.todaysDateMonthDayYear();
    this.data.clientPayment(
      this.client,
      this.savingsAmount,
      date,
      this.paymentAmount
    );
    this.router.navigate(['/client-portal/' + this.id]);
  }

  computeCreditScore() {
    const weeksElapsed = this.time.weeksSince(this.client.dateJoined!);
    const creditScore =
      Number(this.client.numberOfPaymentsMade) * 5 - weeksElapsed * 5;
    return Math.min(creditScore, 100);
  }

  howManyTimesPaidToday() {
    const filteredObj = Object.keys(this.client.payments!).filter((key) =>
      key.startsWith(this.today)
    );
    let number = filteredObj.length;
    return number;
  }
}
