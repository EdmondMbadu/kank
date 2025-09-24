import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-payment-card',
  templateUrl: './payment-card.component.html',
  styleUrls: ['./payment-card.component.css'],
})
export class PaymentCardComponent {
  id: any = '';
  today = this.time.todaysDateMonthDayYear();
  paymentOtherAmount: boolean = false;
  savingsOtherAmount: boolean = false;
  depositAmount: string = '';
  numberOfPaymentToday = 0;
  clientCard: Card = new Card();

  loading = false;
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
    this.retrieveClientCard();
  }

  retrieveClientCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.clientCard = data[Number(this.id)];
      this.depositAmount = this.clientCard.amountToPay!;

      this.numberOfPaymentToday = this.howManyTimesPaidToday();
    });
  }

  async makePayment() {
    if (this.depositAmount === '') {
      alert('Remplissez toutes les données');
      return;
    } else if (Number(this.clientCard.numberOfPaymentsMade) >= 31) {
      alert(
        ` Vous avez dépassé le nombre total de paiements(31) pour 1 cycle de carte. Commencez un nouveau cycle.`
      );
      return;
    } else {
      const conf = confirm(
        ` Vous avez effectué ${this.numberOfPaymentToday} dépôt(s) aujourd'hui. Voulez-vous quand même continuer ?`
      );
      if (!conf) return;

      // Prepare local state
      this.clientCard.amountPaid = (
        Number(this.clientCard.amountPaid) + Number(this.depositAmount)
      ).toString();
      this.clientCard.numberOfPaymentsMade = (
        Number(this.clientCard.numberOfPaymentsMade) + 1
      ).toString();
      this.clientCard.payments = {
        [this.time.todaysDate()]: this.depositAmount,
      };
    }

    this.loading = true; // 👈 show overlay
    try {
      await this.data.atomicClientCardAndUserUpdate(
        this.clientCard,
        this.depositAmount
      );
      this.router.navigate(['/client-portal-card', this.id]); // component unmounts; overlay goes away
    } catch (err) {
      console.error(err);
      alert("Une erreur s'est produite lors d'un paiement, Réessayez");
      this.loading = false; // 👈 hide overlay on error
      return;
    }
  }

  howManyTimesPaidToday() {
    const keys = Object.keys(this.clientCard.payments || {});
    return keys.filter((k) => k.startsWith(this.today)).length;
  }
}
