import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-loss',
  templateUrl: './gestion-loss.component.html',
  styleUrls: ['./gestion-loss.component.css'],
})
export class GestionLossComponent {
  lossAmount: string = '';
  moneyLoss: any = [];
  moneyLossAmounts: string[] = [];
  moneyLossDates: string[] = [];
  moneyLossDollar: any = [];
  moneyLossAmountsDollar: string[] = [];
  moneyLossDatesDollar: string[] = [];
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
      this.getCurrentLoss();
      this.getCurrentDollarLoss();
    });
  }

  async addLoss() {
    if (this.lossAmount === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.lossAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      let conf = confirm(
        ` Vous allez ajouter ${this.lossAmount} FC dans la perte d'aujourdhui. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      try {
        const updateManagement =
          await this.data.updateManagementInfoForMoneyLoss(this.lossAmount);
        this.router.navigate(['/gestion-today']);
      } catch (err: any) {
        alert("Une erreur s'est produite lors de l'initialization, Réessayez");
        console.log('error ocorred while entering reserve amount', err);
        return;
      }
    }
  }
  getCurrentLoss() {
    this.moneyLoss = this.managementInfo!.exchangeLoss;

    let currentMoneyLoss = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.managementInfo!.exchangeLoss!)
    );
    this.moneyLossAmounts = currentMoneyLoss.map((entry) => entry[1]);
    this.moneyLossDates = currentMoneyLoss.map((entry) =>
      this.time.convertTimeFormat(entry[0])
    );
  }
  getCurrentDollarLoss() {
    this.moneyLossDollar = this.managementInfo!.dollarTransferLoss;

    let currentMoneyLossDollar = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.managementInfo!.dollarTransferLoss!)
    );
    this.moneyLossAmountsDollar = currentMoneyLossDollar.map(
      (entry) => entry[1]
    );
    this.moneyLossDatesDollar = currentMoneyLossDollar.map((entry) =>
      this.time.convertTimeFormat(entry[0])
    );
  }
}
