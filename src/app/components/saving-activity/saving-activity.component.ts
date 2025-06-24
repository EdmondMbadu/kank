import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
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
    private compute: ComputationService,
    private afs: AngularFirestore, // ⬅️ new
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

      savingsPaymentsArray =
        this.compute.sortArrayByDateDescendingOrder(savingsPaymentsArray);
      // Extract the sorted payment values and dates into separate arrays
      this.payments = savingsPaymentsArray.map((entry) => entry[1]);
      this.paymentDates = savingsPaymentsArray.map((entry) => entry[0]);
      this.formatPaymentDates();
    });
  }
  formatPaymentDates() {
    for (let p of this.paymentDates) {
      this.formattedPaymentsDates.push(this.time.convertDateToDesiredFormat(p));
    }
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
