import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
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
      
      // Sort by dateKey in descending order (newest first) with correct date parsing
      paymentsArray.sort((a, b) => {
        const timestampA = this.getTimestampFromDateKey(a[0]);
        const timestampB = this.getTimestampFromDateKey(b[0]);
        return timestampB - timestampA; // Descending order (newest first)
      });
      
      // Extract the sorted payment values and dates into separate arrays
      this.payments = paymentsArray.map((entry) => entry[1]);
      this.paymentDates = paymentsArray.map((entry) => entry[0]);
      this.formatPaymentDates();
    });
  }

  // Helper method to convert dateKey to timestamp for sorting
  // dateKey format: M-D-YYYY-HH-mm-ss (month-day-year-hour-minute-second)
  private getTimestampFromDateKey(dateKey: string): number {
    if (!dateKey) {
      return 0;
    }

    const parts = dateKey.split('-');
    if (parts.length < 3) {
      return 0;
    }

    // Format: month-day-year-hour-minute-second
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const hour = parts.length > 3 ? parseInt(parts[3], 10) : 0;
    const minute = parts.length > 4 ? parseInt(parts[4], 10) : 0;
    const second = parts.length > 5 ? parseInt(parts[5], 10) : 0;

    const timestamp = new Date(
      year,
      month - 1, // month is 0-indexed in Date constructor
      day,
      hour,
      minute,
      second
    ).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
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
