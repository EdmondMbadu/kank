import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
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
  rateUsed: string = '';
  loss: string = '';
  moneyInDollar: string = '';
  moneyInDollarIf: string = '';
  rateToday: string = '';
  currentUser: any = {};
  managementInfo?: Management = {};
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
    this.moneyBank = this.managementInfo!.bankDepositDollars;

    let currentMoneyBank = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.managementInfo!.bankDepositDollars!)
    );
    this.moneyBankAmounts = currentMoneyBank.map((entry) => entry[1]);
    this.moneyBankDates = currentMoneyBank.map((entry) =>
      this.time.convertTimeFormat(entry[0])
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
}
