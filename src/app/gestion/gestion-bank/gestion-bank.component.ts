import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-bank',
  templateUrl: './gestion-bank.component.html',
  styleUrls: ['./gestion-bank.component.css'],
})
export class GestionBankComponent {
  bankAmount: string = '';
  moneyBank: any = [];
  moneyBankAmounts: string[] = [];
  moneyBankDates: string[] = [];
  moneyBankEntries: Array<{
    key: string;
    displayDate: string;
    amount: string;
    francAmount: string;
  }> = [];
  rateUsed: string = '';
  loss: string = '';
  moneyInDollar: string = '';
  moneyInDollarIf: string = '';
  rateToday: string = '';
  currentUser: any = {};
  managementInfo?: Management = {};

  // ADD fields
  showRateEditor = false;
  tmpRateDollar: number;
  tmpRateFranc: number;
  editingIndex: number | null = null;
  editingValue: string = '';
  editingFrancValue: string = '';
  isSavingEntry = false;

  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    public compute: ComputationService,
    private time: TimeService
  ) {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.getCurrentServed();
    });
    // In constructor after injecting ComputationService + DataService, ADD:
    this.tmpRateDollar = this.compute.rateDollar;
    this.tmpRateFranc = this.compute.rateFranc;
  }

  async addToBank() {
    if (
      this.bankAmount === '' ||
      this.loss === '' ||
      this.rateToday === '' ||
      this.rateUsed === ''
    ) {
      alert('remplissez toutes les assertions');
      return;
    } else if (
      isNaN(Number(this.bankAmount)) ||
      isNaN(Number(this.rateToday)) ||
      isNaN(Number(this.rateUsed)) ||
      isNaN(Number(this.loss)) ||
      isNaN(Number(this.moneyInDollar))
    ) {
      alert('Entrez un nombre valide dans toutes les cases!');
      return;
    } else {
      let conf = confirm(
        ` Vous allez  ajouter ${this.moneyInDollar} $ dans la banque. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      try {
        const updateManagement =
          await this.data.updateManagementInfoToAddMoneyInTheBank(
            this.bankAmount,
            this.moneyInDollar,
            this.loss
          );
        this.router.navigate(['/gestion-today']);
      } catch (err: any) {
        alert("Une erreur s'est produite lors de l'initialization, Réessayez");
        console.log('error ocorred while entering reserve amount', err);
        return;
      }
    }
  }
  getCurrentServed() {
    const bankEntries = this.managementInfo?.bankDepositDollars || {};
    const francEntries = this.managementInfo?.bankDepositFrancs || {};
    this.moneyBank = bankEntries;

    const sortedEntries = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(bankEntries)
    );

    this.moneyBankEntries = sortedEntries.map(([date, amount]) => ({
      key: date,
      displayDate: this.time.convertTimeFormat(date),
      amount,
      francAmount: francEntries?.[date] ?? '0',
    }));

    this.moneyBankAmounts = this.moneyBankEntries.map((entry) => entry.amount);
    this.moneyBankDates = this.moneyBankEntries.map(
      (entry) => entry.displayDate
    );
  }

  compteDollarAmount() {
    this.moneyInDollar = Math.floor(
      Number(this.bankAmount) / Number(this.rateUsed)
    ).toString();
    this.moneyInDollarIf = Math.floor(
      Number(this.bankAmount) / Number(this.rateToday)
    ).toString();

    this.loss = (
      Number(this.moneyInDollarIf) - Number(this.moneyInDollar)
    ).toString();
  }

  // ADD methods
  toggleRateEditor(force?: boolean) {
    this.showRateEditor =
      typeof force === 'boolean' ? force : !this.showRateEditor;
    if (this.showRateEditor) {
      this.tmpRateDollar = this.compute.rateDollar;
      this.tmpRateFranc = this.compute.rateFranc;
    }
  }

  async saveRates() {
    const rd = Number(this.tmpRateDollar);
    const rf = Number(this.tmpRateFranc);
    if (!Number.isFinite(rd) || rd <= 0 || !Number.isFinite(rf) || rf <= 0) {
      alert('Entrez des valeurs valides pour les deux taux.');
      return;
    }
    this.compute.setRates({ rateDollar: rd, rateFranc: rf }); // live now
    try {
      await this.compute.updateManagementRates(rd, rf);
    } catch {
      /* keep runtime */
    }
    this.showRateEditor = false;
  }

  // convenience for filling inputs elsewhere (optional)
  useActiveRate(target: 'today' | 'used') {
    const v = this.compute.rateDollar ?? 0;
    if (target === 'today') this.rateToday = v.toString();
    else this.rateUsed = v.toString();
    this.compteDollarAmount?.();
  }

  goToGestionToday() {
    if (this.editingIndex !== null) {
      return;
    }
    this.router.navigate(['/gestion-today']);
  }

  startEditing(index: number) {
    if (!this.auth.isAdmin) {
      return;
    }
    const target = this.moneyBankEntries[index];
    if (!target) {
      return;
    }
    this.editingIndex = index;
    this.editingValue = target.amount ?? '';
    this.editingFrancValue = target.francAmount ?? '';
  }

  cancelEditing() {
    this.editingIndex = null;
    this.editingValue = '';
    this.editingFrancValue = '';
  }

  async saveEditedAmount(index: number) {
    if (!this.auth.isAdmin) {
      return;
    }
    const entry = this.moneyBankEntries[index];
    if (!entry) {
      return;
    }

    const trimmedDollar = this.editingValue?.trim();
    const trimmedFranc = this.editingFrancValue?.trim();

    if (!trimmedDollar || !trimmedFranc) {
      alert('Entrez des montants valides.');
      return;
    }

    if (isNaN(Number(trimmedDollar)) || isNaN(Number(trimmedFranc))) {
      alert('Entrez des nombres valides.');
      return;
    }

    this.isSavingEntry = true;
    try {
      await this.data.updateBankDepositEntry(
        entry.key,
        trimmedDollar,
        trimmedFranc
      );
      if (this.managementInfo?.bankDepositDollars) {
        this.managementInfo.bankDepositDollars[entry.key] = trimmedDollar;
      }
      if (this.managementInfo?.bankDepositFrancs) {
        this.managementInfo.bankDepositFrancs[entry.key] = trimmedFranc;
      }
      this.getCurrentServed();
      this.cancelEditing();
    } catch (err) {
      console.error('Failed to update bank deposit amount', err);
      alert('La mise à jour du montant a échoué. Réessayez.');
    } finally {
      this.isSavingEntry = false;
    }
  }
}
