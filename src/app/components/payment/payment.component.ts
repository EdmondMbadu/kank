import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { firstValueFrom } from 'rxjs';
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
  paymentMethod: 'manual' | 'mobile' = 'manual';
  mobileMoneyPhone = '';
  mobileMoneyStatus = '';
  mobileMoneyError = '';
  mobileMoneyReference = '';
  mobileMoneyOrderNumber = '';
  private readonly mobileCheckIntervalMs = 5000;

  client: Client = new Client();
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private time: TimeService,
    private compute: ComputationService,
    private performance: PerformanceService,
    private fns: AngularFireFunctions
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
    const methodQuery = this.activatedRoute.snapshot.queryParamMap.get('method');
    if (methodQuery === 'mobile' && this.auth.isAdmninistrator) {
      this.paymentMethod = 'mobile';
    }
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];

      this.minPayment = this.compute.minimumPayment(this.client);
      this.numberOfPaymentToday = this.howManyTimesPaidToday();
      this.mobileMoneyPhone = this.normalizePhoneInput(this.client.phoneNumber || '');
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
  onPaymentMethodChange() {
    this.mobileMoneyError = '';
    this.mobileMoneyStatus = '';
    if (this.paymentMethod === 'mobile' && !this.mobileMoneyPhone) {
      this.mobileMoneyPhone = this.normalizePhoneInput(this.client.phoneNumber || '');
    }
  }

  submitPayment() {
    if (this.paymentMethod === 'mobile') {
      this.makeMobileMoneyPayment();
      return;
    }
    this.makePayment();
  }

  private validateBasePaymentInputs(): boolean {
    if (this.paymentAmount === '' || this.savingsAmount === '') {
      alert('Remplissez toutes les données');
      return false;
    } else if (
      Number.isNaN(Number(this.paymentAmount)) ||
      Number.isNaN(Number(this.savingsAmount))
    ) {
      alert('Entrée incorrecte. Entrez un numéro');
      return false;
    } else if (
      !this.auth.isAdmninistrator &&
      (Number(this.paymentAmount) < 0 || Number(this.savingsAmount) < 0)
    ) {
      alert('les nombres doivent etre positifs');
      return false;
    } else if (
      !this.auth.isAdmninistrator &&
      Number(this.paymentAmount) <= 0 &&
      Number(this.savingsAmount) <= 0
    ) {
      alert('Au moins un nombre doit etre plus grand que 0.');
      return false;
    } else if (
      !this.auth.isAdmninistrator &&
      Number(this.client.debtLeft) <= 0
    ) {
      alert('Vous avez tout payé. Plus besoin de paiements!');
      return false;
    } else if (Number(this.paymentAmount) > Number(this.client.debtLeft)) {
      alert(
        'Votre paiement dépassera le montant nécessaire. Ajuster le montant'
      );
      return false;
    }
    return true;
  }

  makePayment() {
    if (this.isSubmitting) return; // hard guard against double clicks
    if (!this.validateBasePaymentInputs()) {
      return;
    }
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

  async makeMobileMoneyPayment() {
    if (!this.auth.isAdmninistrator) {
      alert('Le paiement mobile money est réservé aux administrateurs.');
      return;
    }
    if (this.isSubmitting) return;
    if (!this.validateBasePaymentInputs()) return;

    const localPhone = this.normalizePhoneInput(this.mobileMoneyPhone);
    if (!/^\d{10}$/.test(localPhone)) {
      this.mobileMoneyError = 'Le numéro doit contenir exactement 10 chiffres.';
      return;
    }

    let conf = confirm(
      ` Vous avez effectué ${this.numberOfPaymentToday} paiement(s) aujourd'hui. Continuer avec Mobile Money ?`
    );
    if (!conf) return;

    this.mobileMoneyError = '';
    this.mobileMoneyStatus = 'Initialisation du paiement Mobile Money...';
    this.isSubmitting = true;

    try {
      const initCallable = this.fns.httpsCallable('initMobileMoneyPayment');
      const initResponse: any = await firstValueFrom(
        initCallable({
          clientUid: this.client.uid,
          paymentAmount: this.paymentAmount,
          savingsAmount: this.savingsAmount,
          currency: 'CDF',
          phone: localPhone,
          dayKey: this.time.todaysDateMonthDayYear(),
          paymentEntryKey: this.time.todaysDate(),
        })
      );

      this.mobileMoneyReference = initResponse?.reference || '';
      this.mobileMoneyOrderNumber = initResponse?.orderNumber || '';
      this.mobileMoneyStatus =
        "Demande envoyée. Veuillez valider le push Mobile Money sur le téléphone du client.";

      if (!this.mobileMoneyReference) {
        throw new Error('Reference FlexPay manquante.');
      }

      const checkResult = await this.pollMobileMoneyStatus(this.mobileMoneyReference);
      if (checkResult.status === 'SUCCESS') {
        this.mobileMoneyStatus = 'Paiement confirmé et enregistré.';
        this.router.navigate(['/client-portal', this.id]);
        return;
      }
      if (checkResult.status === 'FAILED') {
        this.mobileMoneyError = this.composeMobileMoneyFailureMessage(
          checkResult.failureReason
        );
        this.mobileMoneyStatus = '';
        return;
      }

    } catch (err: any) {
      console.error('Mobile money payment flow failed:', err);
      this.mobileMoneyError =
        err?.message || "Le paiement Mobile Money n'a pas pu être traité.";
      this.mobileMoneyStatus = '';
    } finally {
      this.isSubmitting = false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async pollMobileMoneyStatus(
    reference: string
  ): Promise<{
    status: 'SUCCESS' | 'FAILED';
    failureReason: string;
    message: string;
  }> {
    const checkCallable = this.fns.httpsCallable('checkMobileMoneyPayment');
    let attempt = 0;
    while (true) {
      attempt += 1;
      await this.sleep(this.mobileCheckIntervalMs);
      this.mobileMoneyStatus = `Vérification du paiement Mobile Money... (tentative ${attempt})`;
      const checkResponse: any = await firstValueFrom(
        checkCallable({ reference })
      );
      const status = String(checkResponse?.status || 'PENDING');
      const failureReason = String(checkResponse?.failureReason || '').trim();
      const message = String(checkResponse?.message || '').trim();
      if (status === 'SUCCESS') {
        return { status: 'SUCCESS', failureReason, message };
      }
      if (status === 'FAILED') {
        return { status: 'FAILED', failureReason, message };
      }

      if (message) {
        this.mobileMoneyStatus = `Vérification du paiement Mobile Money... (tentative ${attempt}) - ${message}`;
      }
    }
  }

  private normalizePhoneInput(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  private composeMobileMoneyFailureMessage(reason: string): string {
    const trimmed = String(reason || '').trim();
    if (trimmed) {
      return `La transaction Mobile Money a échoué: ${trimmed}`;
    }
    return "La transaction Mobile Money a échoué. Aucun paiement n'a été enregistré.";
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
      dateX = this.time.getDateInFiveWeeksPlus(this.client.debtCycleStartDate!);
    } else if (Number(this.client.paymentPeriodRange) === 8) {
      dateX = this.time.getDateInNineWeeksPlus(this.client.debtCycleStartDate!);
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
