import { Component } from '@angular/core';
import { isFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
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
  minPayment: string = '';
  isSubmitting = false;

  client: Client = new Client();
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private time: TimeService,
    private compute: ComputationService,
    private performance: PerformanceService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];

      this.minPayment = this.compute.minimumPayment(this.client);
      this.numberOfPaymentToday = this.howManyTimesPaidToday();
    });
  }
  displaySavingsOtherAmount() {
    if (this.savingsAmount === 'Autre Montant') {
      this.savingsOtherAmount = true;
      this.savingsAmount = '';
    } else {
      this.savingsOtherAmount = false;
    }
  }
  displayPaymentOtherAmount() {
    if (this.paymentAmount === 'Autre Montant') {
      this.paymentOtherAmount = true;
      this.paymentAmount = '';
    } else {
      this.paymentOtherAmount = false;
    }
  }

  makePayment() {
    if (this.isSubmitting) return; // hard guard against double clicks
    if (this.paymentAmount === '' || this.savingsAmount === '') {
      alert('Remplissez toutes les données');
      return;
    } else if (
      Number.isNaN(Number(this.paymentAmount)) ||
      Number.isNaN(Number(this.savingsAmount))
    ) {
      alert('Entrée incorrecte. Entrez un numéro');
      return;
    } // skip this test if admin because they can undo a payment
    else if (
      !this.auth.isAdmninistrator &&
      (Number(this.paymentAmount) < 0 || Number(this.savingsAmount) < 0)
    ) {
      alert('les nombres doivent etre positifs');
      return;
    } // skip this test if admin because they can undo a payment
    else if (
      !this.auth.isAdmninistrator &&
      Number(this.paymentAmount) <= 0 &&
      Number(this.savingsAmount) <= 0
    ) {
      alert('Au moins un nombre doit etre plus grand que 0.');
      return;
    } else if (
      !this.auth.isAdmninistrator &&
      Number(this.client.debtLeft) <= 0
    ) {
      alert('Vous avez tout payé. Plus besoin de paiements!');
      return;
    } else if (Number(this.paymentAmount) > Number(this.client.debtLeft)) {
      alert(
        'Votre paiement dépassera le montant nécessaire. Ajuster le montant'
      );
      return;
    } else {
      let conf = confirm(
        ` Vous avez effectué ${this.numberOfPaymentToday} paiement(s) aujourd'hui. Voulez-vous quand même continuer ?`
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

      this.client.creditScore = this.computeCreditScore();
    }
    let date = this.time.todaysDateMonthDayYear();
    this.isSubmitting = true; // 👉 show loader + disable button immediately
    this.data
      .clientPaymentAndStats(
        this.client,
        this.savingsAmount,
        date,
        this.paymentAmount
      )
      .then(() => {
        // only updates performance if the payment is positive
        if (Number(this.paymentAmount) > 0) {
          this.performance.updateUserPerformance(
            this.client,
            this.paymentAmount
          );
        }

        this.router.navigate(['/client-portal', this.id]);
      })
      .catch((err) => {
        console.error('Failed to write payment+stats', err);
        alert("Le paiement n'a pas pu être enregistré. Réessayez.");
      })
      .finally(() => {
        this.isSubmitting = false; // safety in case navigation doesn’t happen
      });
  }

  computeCreditScore() {
    let dateX = '';
    let creditScore = '';
    // if the user still has some debt
    if (Number(this.client.debtLeft) > 0) {
      return this.client.creditScore;
    }
    // if the payment amount is 0, don't compute the credit score
    if (Number(this.paymentAmount) === 0) {
      return this.client.creditScore;
    }
    if (Number(this.client.paymentPeriodRange) === 4) {
      dateX = this.time.getDateInFiveWeeks(this.client.debtCycleStartDate!);
    } else if (Number(this.client.paymentPeriodRange) === 8) {
      dateX = this.time.getDateInNineWeeks(this.client.debtCycleStartDate!);
    }
    let today = this.time.todaysDateMonthDayYear();
    // +5 for finishing the payment anytime early or on the date
    if (this.time.isGivenDateLessOrEqual(dateX, today)) {
      creditScore = (Number(this.client.creditScore) + 5).toString();
      // -2 every week you are late
    } else if (!this.time.isGivenDateLessOrEqual(dateX, today)) {
      let elapsed = this.time.weeksElapsed(dateX, today);

      creditScore = (Number(this.client.creditScore) - 2 * elapsed).toString();
    }
    // no more max credit score
    // creditScore = Math.min(Number(creditScore), 100).toString();

    return creditScore;
  }

  howManyTimesPaidToday() {
    const filteredObj = Object.keys(this.client.payments!).filter((key) =>
      key.startsWith(this.today)
    );
    let number = filteredObj.length;
    return number;
  }
}
