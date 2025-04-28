import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-withdraw-savings',
  templateUrl: './withdraw-savings.component.html',
  styleUrls: ['./withdraw-savings.component.css'],
})
export class WithdrawSavingsComponent implements OnInit {
  id: any = '';
  paymentOtherAmount: boolean = false;
  savingsOtherAmount: boolean = false;
  savingsWithdrawn: string = '';
  client: Client = new Client();
  constructor(
    private router: Router,
    public auth: AuthService,
    private data: DataService,
    private activatedRoute: ActivatedRoute,
    private time: TimeService,
    private afs: AngularFirestore, // <-- NEW
    private performance: PerformanceService // <-- NEW
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
  /** true ⇢ the withdrawal will be pushed into “paiements” */
  get isTransferToPayment(): boolean {
    return +this.client.debtLeft! > 0;
  }

  /** dynamic title displayed in the H1 */
  get withdrawalLabel(): string {
    return this.isTransferToPayment
      ? "Transfert de l'épargne vers Paiement"
      : "Retrait de l'épargne";
  }
  /** dynamic sentence used in the confirm dialog */
  private buildConfirmText(amount: number): string {
    return this.isTransferToPayment
      ? `Vous allez transférer ${amount} FC de l'épargne vers le paiement de la dette. Continuer ?`
      : `Vous allez retrancher ${amount} FC de votre compte d'épargne. Continuer ?`;
  }
  displaySavingsOtherAmount() {
    if (this.savingsWithdrawn === 'Autre Montant') {
      this.savingsOtherAmount = true;
      this.savingsWithdrawn = '';
    } else {
      this.savingsOtherAmount = false;
    }
  }
  computeCreditScore() {
    let dateX = '';
    let creditScore = '';
    if (this.client.debtLeft !== '0') {
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
    creditScore = Math.min(Number(creditScore), 100).toString();

    return creditScore;
  }
  makePayment() {
    if (this.savingsWithdrawn === '') {
      alert('emplissez toutes les données');
      return;
    } else if (Number.isNaN(Number(this.savingsWithdrawn))) {
      alert('Entrée incorrecte. Entrez un numéro');
      return;
    } else if (Number(this.savingsWithdrawn) > Number(this.client.savings)) {
      alert(
        "Vous n'avez pas suffisament d'argent pour effectuer cette transaction!"
      );
      return;
    } else if (Number(this.savingsWithdrawn) <= 0) {
      alert('Entrez un nombre valid positifs');
      return;
    }
    const amountNum = +this.savingsWithdrawn;
    const conf = confirm(this.buildConfirmText(amountNum));
    if (!conf) {
      return;
    } else {
      this.client.savings = (
        Number(this.client.savings) - Number(this.savingsWithdrawn)
      ).toString();
      this.client.savingsPayments = {
        [this.time.todaysDate()]: `-${this.savingsWithdrawn}`,
      };

      this.data.clientWithdrawFromSavings(this.client, this.savingsWithdrawn);
      this.router.navigate(['/client-portal/' + this.id]);
    }
  }
  /* ---------------------------------------------------------------------- */
  /*                          NEW withdraw logic                            */
  /* ---------------------------------------------------------------------- */
  // withDrawSavings() {
  //   /* ---------- validations (unchanged) ---------- */
  //   if (this.savingsWithdrawn === '') {
  //     alert('emplissez toutes les données');
  //     return;
  //   }
  //   if (Number.isNaN(+this.savingsWithdrawn)) {
  //     alert('Entrée incorrecte. Entrez un numéro');
  //     return;
  //   }
  //   if (+this.savingsWithdrawn > +this.client.savings!) {
  //     alert(
  //       "Vous n'avez pas suffisament d'argent pour effectuer cette transaction!"
  //     );
  //     return;
  //   }
  //   if (+this.savingsWithdrawn <= 0) {
  //     alert('Entrez un nombre valid positifs');
  //     return;
  //   }

  //   /* ---------- confirm ---------- */
  //   const amountNum = +this.savingsWithdrawn;
  //   const conf = confirm(this.buildConfirmText(amountNum));
  //   if (!conf) {
  //     return;
  //   }

  //   const today = this.time.todaysDate(); // e.g. 26-04-2025
  //   const todayMDY = this.time.todaysDateMonthDayYear(); // e.g. 4-26-2025

  //   /* ------------------------------------------------------------------
  //    CASE A · Client already paid everything ➜ ordinary withdrawal only
  // ------------------------------------------------------------------ */
  //   if (+this.client.debtLeft! <= 0) {
  //     this.client.savings = (+this.client.savings! - amountNum).toString();
  //     this.client.savingsPayments = { [today]: `-${amountNum}` };

  //     this.data
  //       .clientWithdrawFromSavings(this.client, this.savingsWithdrawn)
  //       .then(() => this.router.navigate(['/client-portal', this.id]));
  //     return;
  //   }

  //   /* ------------------------------------------------------------------
  //    CASE B · Debt still open ➜ transfer savings → payment
  // ------------------------------------------------------------------ */
  //   if (amountNum > +this.client.debtLeft!) {
  //     alert('Le retrait dépasse la dette restante. Ajustez le montant.');
  //     return;
  //   }

  //   /* 1️⃣  Update in-memory client object */
  //   /* remove from savings */
  //   this.client.savings = (+this.client.savings! - amountNum).toString();
  //   this.client.savingsPayments = { [today]: `-${amountNum}` };

  //   /* add as payment */
  //   this.client.amountPaid = (+this.client.amountPaid! + amountNum).toString();
  //   this.client.numberOfPaymentsMade = (
  //     +this.client.numberOfPaymentsMade! + 1
  //   ).toString();
  //   this.client.numberOfPaymentsMissed = Math.max(
  //     0,
  //     this.time.weeksSince(this.client.dateJoined!) -
  //       +this.client.numberOfPaymentsMade
  //   ).toString();
  //   this.client.payments = { [today]: amountNum.toString() };
  //   this.client.debtLeft = (
  //     +this.client.amountToPay! - +this.client.amountPaid
  //   ).toString();
  //   this.client.creditScore = this.computeCreditScore();

  //   /* 2️⃣  Persist both updates atomically */
  //   const clientPath = `users/${this.auth.currentUser.uid}/clients/${this.client.uid}`;
  //   const userPath = `users/${this.auth.currentUser.uid}`;

  //   this.afs.firestore
  //     .runTransaction(async (t) => {
  //       /* ---- client document ---- */
  //       t.set(
  //         this.afs.doc(clientPath).ref,
  //         {
  //           /* savings side */
  //           savings: this.client.savings,
  //           savingsPayments: this.client.savingsPayments,
  //           /* payment side  */
  //           amountPaid: this.client.amountPaid,
  //           numberOfPaymentsMade: this.client.numberOfPaymentsMade,
  //           numberOfPaymentsMissed: this.client.numberOfPaymentsMissed,
  //           payments: this.client.payments,
  //           debtLeft: this.client.debtLeft,
  //           creditScore: this.client.creditScore,
  //         },
  //         { merge: true }
  //       );

  //       /* ---- user aggregate document ---- */
  //       /* –– subtract from clientsSavings (withdraw) –
  //      –– add to moneyInHands & dailyReimbursement (payment) */
  //       const u = this.auth.currentUser;
  //       const save = this.data.computeDailySaving(todayMDY, '0'); // 0 because no new saving deposit
  //       // const sa = this.data.computeDailyCardReturns(todayMDY,)
  //       const reimb = this.data.computeDailyReimbursement(
  //         todayMDY,
  //         amountNum.toString()
  //       );

  //       t.set(
  //         this.afs.doc(userPath).ref,
  //         {
  //           clientsSavings: (Number(u.clientsSavings) - amountNum).toString(),
  //           // moneyInHands: (Number(u.moneyInHands) + amountNum).toString(),
  //           totalDebtLeft: (Number(u.totalDebtLeft) - amountNum).toString(),
  //           dailySaving: { [todayMDY]: `${save}` },
  //           dailySavingReturns: {
  //             [todayMDY]: `${save}`,
  //           },
  //           dailyReimbursement: { [todayMDY]: `${reimb}` },
  //         },
  //         { merge: true }
  //       );
  //     })
  //     .then(() => {
  //       /* 3️⃣  performance metrics, then redirect */
  //       this.performance.updateUserPerformance(
  //         this.client,
  //         this.savingsWithdrawn
  //       );
  //       this.router.navigate(['/client-portal', this.id]);
  //     });
  // }
  /* ---------------------------------------------------------------------- */
}
