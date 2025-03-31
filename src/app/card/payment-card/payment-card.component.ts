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
    } else {
      let conf = confirm(
        ` Vous avez effectué ${this.numberOfPaymentToday} dépôt(s) aujourd'hui. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
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

    try {
      // 1. Use the new atomic method
      await this.data.atomicClientCardAndUserUpdate(
        this.clientCard,
        this.depositAmount
      );

      // 2. If it all succeeded, proceed
      this.router.navigate(['/client-portal-card/' + this.id]);
    } catch (err) {
      alert("Une erreur s'est produite lors d'un paiement, Réessayez");
      console.error(err);
      return;
    }
  }

  howManyTimesPaidToday() {
    const filteredObj = Object.keys(this.clientCard.payments!).filter((key) =>
      key.startsWith(this.today)
    );
    let number = filteredObj.length;
    return number;
  }
}
