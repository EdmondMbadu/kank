import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import 'firebase/compat/firestore'; // makes FieldValue available

@Component({
  selector: 'app-payment-activity',
  templateUrl: './payment-activity.component.html',
  styleUrls: ['./payment-activity.component.css'],
})
export class PaymentActivityComponent implements OnInit {
  id: any = '';
  client: Client = new Client();
  public payments: string[] = [];
  public paymentDates: string[] = [];
  public formattedPaymentsDates: string[] = [];
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private time: TimeService,
    private afs: AngularFirestore,
    private router: Router
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit() {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];

      let paymentsArray = Object.entries(this.client.payments!);
      // remove the 0 amount payments UI ( means nothing)
      paymentsArray = paymentsArray.filter(
        (item: any) => item[1] !== 0 && item[1] !== '0'
      );
      
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
  goToClient(ev: Event) {
    // do nothing if the click bubbled from the delete button
    if ((ev.target as HTMLElement).closest('button')) return;
    // your current routing logic:
    this.router.navigate(['/client-portal', this.id]);
  }

  /** Delete a single payment (admin-only) */
  async deletePayment(dateKey: string, ev: Event) {
    ev.stopPropagation();
    const formatted = this.time.convertDateToDesiredFormat(dateKey);
    if (!confirm(`Supprimer le paiement du ${formatted} ?`)) return;

    try {
      /* 1️⃣  Build a fresh payments object without the chosen key */
      const newPayments: { [d: string]: string } = { ...this.client.payments };
      delete newPayments[dateKey];

      /* 2️⃣  Push it back to Firestore in one set() */
      await this.afs
        .doc(`users/${this.auth.currentUser.uid}/clients/${this.client.uid}`)
        .update({ payments: newPayments }); // ← overwrites only the payments map

      /* 3️⃣  Update local copies so UI refreshes instantly */
      const idx = this.paymentDates.indexOf(dateKey);
      if (idx > -1) {
        this.paymentDates.splice(idx, 1);
        this.payments.splice(idx, 1);
        this.formattedPaymentsDates.splice(idx, 1);
      }
      this.client.payments = newPayments; // keep in-sync
    } catch (err: any) {
      alert('Échec de suppression : ' + err.message);
    }
  }
}
