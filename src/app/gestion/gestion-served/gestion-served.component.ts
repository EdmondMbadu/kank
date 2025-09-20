import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-served',
  templateUrl: './gestion-served.component.html',
  styleUrls: ['./gestion-served.component.css'],
})
export class GestionServedComponent {
  reserveAmount: string = '';
  moneyGiven: Record<string, string> = {};
  moneyGivenAmounts: string[] = [];
  moneyGivenDates: string[] = [];
  currentUser: any = {};
  managementInfo?: Management = {};
  records: Array<{
    dateKey: string;
    dateLabel: string;
    amount: number;
    leftAfter: number | null;
  }> = [];

  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.getCurrentServed();
    });
  }

  async addToReserve() {
    if (this.reserveAmount === '') {
      alert('Fill all fields!');
      return;
    }
    if (isNaN(Number(this.reserveAmount))) {
      alert('Enter a valid number!');
      return;
    }

    const conf = confirm(
      `Vous allez marquer ${Number(
        this.reserveAmount
      ).toLocaleString()} FC comme "Argent à servir" (demain/aujourd'hui). Continuer ?`
    );
    if (!conf) return;

    try {
      await this.data.updateManagementInfoForMoneyGiven(this.reserveAmount);
      this.router.navigate(['/gestion-today']);
    } catch (err) {
      alert("Une erreur s'est produite. Réessayez.");
      console.error('reserve amount error', err);
    }
  }

  getCurrentServed() {
    if (!this.managementInfo?.moneyGiven) {
      this.moneyGiven = {};
      this.records = [];
      return;
    }

    this.moneyGiven = this.managementInfo.moneyGiven as Record<string, string>;
    const tracking =
      (this.managementInfo.moneyInHandsTracking as Record<string, string>) ||
      {};

    // Sort by your existing util (descending, newest first)
    const currentMoneyGiven = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.moneyGiven)
    ) as Array<[string, string]>; // [dateKey, amountStr]

    this.records = currentMoneyGiven.map(([dateKey, amountStr]) => {
      const leftStr = tracking?.[dateKey];
      return {
        dateKey,
        dateLabel: this.time.convertTimeFormat(dateKey),
        amount: Number(amountStr),
        leftAfter: leftStr != null ? Number(leftStr) : null, // graceful if not present
      };
    });
    this.onQuery();
  }
  trackByDateKey(index: number, r: { dateKey: string }) {
    return r?.dateKey ?? index;
  }
  // add these fields
  query: string = '';
  filtered: Array<{
    dateKey: string;
    dateLabel: string;
    amount: number;
    leftAfter: number | null;
  }> = [];

  // helper: enable/disable "Ajouter"
  canSubmit(): boolean {
    const n = Number(this.reserveAmount);
    return !!this.reserveAmount && !isNaN(n) && n > 0;
  }

  // live filter (search by amount or date label)
  onQuery() {
    const q = (this.query || '').trim().toLowerCase();
    if (!q) {
      this.filtered = [...this.records];
      return;
    }
    this.filtered = this.records.filter(
      (r) =>
        r.dateLabel.toLowerCase().includes(q) ||
        ('' + r.amount).includes(q) ||
        (r.leftAfter !== null && ('' + r.leftAfter).includes(q))
    );
  }
}
