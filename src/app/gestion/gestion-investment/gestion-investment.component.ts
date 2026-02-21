import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-investment',
  templateUrl: './gestion-investment.component.html',
  styleUrls: ['./gestion-investment.component.css'],
})
export class GestionInvestmentComponent {
  investmentAmount: string = '';
  investment: any = [];
  currentInvestment: [string, string][] = [];
  investmentAmounts: string[] = [];
  investmentDates: string[] = [];
  currentUser: any = {};
  managementInfo?: Management = {};
  showAllInvestments = false;
  deletingInvestmentKey: string | null = null;
  showDeleteInvestmentModal = false;
  pendingDeleteInvestment: {
    key: string;
    amount: number;
    dateLabel: string;
  } | null = null;
  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.currentUser = this.auth.currentUser;
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.getCurrentInvestment();
    });
  }

  async addToInvestment() {
    if (this.investmentAmount === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.investmentAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      let conf = confirm(
        ` Vous ajouter dans l'investissement ${this.investmentAmount} FC. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      try {
        const updateManagement =
          await this.data.updateManagementInfoForAddToInvestment(
            this.investmentAmount
          );
        this.router.navigate(['/gestion-today']);
      } catch (err: any) {
        alert("Une erreur s'est produite lors de l'initialization, Réessayez");

        return;
      }
    }
  }
  getCurrentInvestment() {
    this.investment = this.managementInfo?.investment || {};

    this.currentInvestment = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.investment)
    );
    this.investmentAmounts = this.currentInvestment.map((entry) => entry[1]);
    this.investmentDates = this.currentInvestment.map((entry) =>
      this.time.convertTimeFormat(entry[0])
    );
  }

  hasMoreInvestments(): boolean {
    return this.currentInvestment.length > 4;
  }

  openDeleteInvestmentModal(entryKey: string, event: Event): void {
    event.stopPropagation();
    if (!this.auth.isAdmin) return;
    if (this.deletingInvestmentKey) return;

    const amountRaw = this.investment?.[entryKey];
    const amount = Number(amountRaw) || 0;
    const formattedDate = this.time.convertTimeFormat(entryKey);
    this.pendingDeleteInvestment = {
      key: entryKey,
      amount,
      dateLabel: formattedDate,
    };
    this.showDeleteInvestmentModal = true;
  }

  closeDeleteInvestmentModal(): void {
    if (this.deletingInvestmentKey) return;
    this.showDeleteInvestmentModal = false;
    this.pendingDeleteInvestment = null;
  }

  async confirmDeleteInvestment(
    choice: 'deleteOnly' | 'deleteAndDeduct'
  ): Promise<void> {
    const pending = this.pendingDeleteInvestment;
    if (!pending) return;
    const shouldDeduct = choice === 'deleteAndDeduct';

    try {
      this.deletingInvestmentKey = pending.key;
      await this.data.deleteManagementInvestmentEntry(
        pending.key,
        shouldDeduct
      );
      const nextInvestments = { ...(this.managementInfo?.investment || {}) };
      delete nextInvestments[pending.key];
      this.managementInfo = {
        ...(this.managementInfo || {}),
        investment: nextInvestments,
        moneyInHands: shouldDeduct
          ? (
              Number(this.managementInfo?.moneyInHands || 0) -
              Number(pending.amount)
            ).toString()
          : this.managementInfo?.moneyInHands,
      };
      this.getCurrentInvestment();
      this.closeDeleteInvestmentModal();
    } catch (err: any) {
      alert(
        `La suppression de l'investissement a échoué: ${err?.message || 'Erreur inconnue'}`
      );
    } finally {
      this.deletingInvestmentKey = null;
    }
  }
}
