import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Component({
  selector: 'app-saving-activity',
  templateUrl: './saving-activity.component.html',
  styleUrls: ['./saving-activity.component.css'],
})
export class SavingActivityComponent implements OnInit {
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

      let savingsPaymentsArray = Object.entries(this.client.savingsPayments!);
      // remove the 0 amount savings ( means nothing)
      savingsPaymentsArray = savingsPaymentsArray.filter(
        (item: any) => item[1] !== 0 && item[1] !== '0'
      );

      // Sort by dateKey in descending order (newest first) with correct date parsing
      savingsPaymentsArray.sort((a, b) => {
        const timestampA = this.getTimestampFromDateKey(a[0]);
        const timestampB = this.getTimestampFromDateKey(b[0]);
        return timestampB - timestampA; // Descending order (newest first)
      });

      // Extract the sorted payment values and dates into separate arrays
      this.payments = savingsPaymentsArray.map((entry) => entry[1]);
      this.paymentDates = savingsPaymentsArray.map((entry) => entry[0]);
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
    this.formattedPaymentsDates = this.paymentDates.map((dateKey) =>
      this.time.convertDateToDesiredFormat(dateKey)
    );
  }
  goToClient(ev: Event) {
    // ignore clicks that originated on the delete button
    if ((ev.target as HTMLElement).closest('button')) return;
    this.router.navigate(['/client-portal', this.id]);
  }

  async deleteSaving(dateKey: string, ev: Event) {
    ev.stopPropagation();
    const formatted = this.time.convertDateToDesiredFormat(dateKey);
    if (!confirm(`Supprimer l’épargne du ${formatted} ?`)) return;

    try {
      /* 1. Re-build savingsPayments without the selected entry */
      const newSavings: { [d: string]: string } = {
        ...this.client.savingsPayments,
      };
      delete newSavings[dateKey];

      /* 2. Update Firestore – only the map is replaced */
      await this.afs
        .doc(`users/${this.auth.currentUser.uid}/clients/${this.client.uid}`)
        .update({ savingsPayments: newSavings });

      /* 3. Keep UI in sync */
      const idx = this.paymentDates.indexOf(dateKey);
      if (idx > -1) {
        this.paymentDates.splice(idx, 1);
        this.payments.splice(idx, 1);
        this.formattedPaymentsDates.splice(idx, 1);
      }
      this.client.savingsPayments = newSavings;
    } catch (err: any) {
      alert('Échec de suppression : ' + err.message);
    }
  }
}
