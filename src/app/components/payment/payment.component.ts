import { Component } from '@angular/core';
import { isFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.css'],
})
export class PaymentComponent {
  id: any = '';
  paymentOtherAmount: boolean = false;
  savingsOtherAmount: boolean = false;
  savingsAmount: string = '';
  paymentAmount: string = '';
  client: Client = new Client();
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private data: DataService,
    private router: Router
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
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
    } else {
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
        this.weeksSince(this.client.dateJoined!) -
          Number(this.client.numberOfPaymentsMade)
      ).toString();

      this.client.payments = { [this.paymentDate()]: this.paymentAmount };
      if (this.savingsAmount !== '0') {
        this.client.savings = (
          Number(this.client.savings) + Number(this.savingsAmount)
        ).toString();
        this.client.savingsPayments = {
          [this.paymentDate()]: this.savingsAmount,
        };
      }
    }
    console.log('client class', this.client);
    this.data.clientPayment(this.client);
    this.router.navigate(['/client-portal/' + this.id]);
  }

  paymentDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    let date = `${month}-${day}-${year}-${hours}-${minutes}-${seconds}`;

    return date;
  }

  computeCreditScore() {
    const weeksElapsed = this.weeksSince(this.client.dateJoined!);
    const creditScore =
      Number(this.client.numberOfPaymentsMade) * 5 - weeksElapsed * 5;
    return Math.min(creditScore, 100);
  }

  weeksSince(dateString: string) {
    const givenDate: any = new Date(dateString);
    const today: any = new Date();

    // Reset the time parts to avoid time offsets
    givenDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const daysPassed = (today - givenDate) / millisecondsPerDay;
    const weeksPassed = daysPassed / 7;

    return Math.floor(weeksPassed);
  }
}
