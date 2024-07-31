import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
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
  investmentAmounts: string[] = [];
  investmentDates: string[] = [];
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
        console.log('error ocorred while entering reserve amount', err);
        return;
      }
    }
  }
  getCurrentInvestment() {
    this.investment = this.managementInfo!.investment;

    let currentInvestment = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.managementInfo!.investment!)
    );
    this.investmentAmounts = currentInvestment.map((entry) => entry[1]);
    this.investmentDates = currentInvestment.map((entry) =>
      this.time.convertTimeFormat(entry[0])
    );
  }
}
