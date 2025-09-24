import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Component({
  selector: 'app-payment-activity-card',
  templateUrl: './payment-activity-card.component.html',
  styleUrls: ['./payment-activity-card.component.css'],
})
export class PaymentActivityCardComponent implements OnInit {
  id: any = '';
  clientCard: Card = new Card();
  public payments: string[] = [];
  public paymentDates: string[] = [];
  public formattedPaymentsDates: string[] = [];
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private afs: AngularFirestore
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit() {
    this.retrieveClientCard();
  }

  retrieveClientCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.clientCard = data[Number(this.id)];
      // this.payments = Object.values(this.client.payments!);
      // this.paymentDates = Object.keys(this.client.payments!);
      let paymentsArray = Object.entries(this.clientCard.payments!);
      paymentsArray =
        this.compute.sortArrayByDateDescendingOrder(paymentsArray);
      // Extract the sorted payment values and dates into separate arrays
      this.payments = paymentsArray.map((entry) => entry[1]);
      this.paymentDates = paymentsArray.map((entry) => entry[0]);
      this.formatPaymentDates();
    });
  }
  formatPaymentDates() {
    for (let p of this.paymentDates) {
      this.formattedPaymentsDates.push(this.time.convertDateToDesiredFormat(p));
    }
  }

  async deletePaymentCard(dateKey: string, ev: Event) {
    ev.stopPropagation();

    const formatted = this.time.convertDateToDesiredFormat(dateKey);
    if (!confirm(`Supprimer le paiement carte du ${formatted} ?`)) return;

    try {
      // Guard rails
      const docId = (this.clientCard as any)?.uid;
      if (!docId) {
        throw new Error(
          'clientCard.uid manquant — assurez-vous d’inclure idField: "uid" quand vous chargez les cartes.'
        );
      }

      // 1) Build a fresh payments map without this entry
      const newPayments: { [d: string]: string } = {
        ...(this.clientCard.payments || {}),
      };
      delete newPayments[dateKey];

      // 2) Update the card document at the correct path
      const path = `users/${this.auth.currentUser.uid}/cards/${docId}`;
      await this.afs.doc(path).update({ payments: newPayments });

      // 3) Update local arrays so the UI reflects the change instantly
      const idx = this.paymentDates.indexOf(dateKey);
      if (idx > -1) {
        this.paymentDates.splice(idx, 1);
        this.payments.splice(idx, 1);
        this.formattedPaymentsDates.splice(idx, 1);
      }
      this.clientCard.payments = newPayments;
    } catch (err: any) {
      alert('Échec de suppression : ' + (err?.message || 'Erreur inconnue'));
    }
  }
}
