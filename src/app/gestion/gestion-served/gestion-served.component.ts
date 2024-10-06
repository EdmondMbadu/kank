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
  moneyGiven: any = [];
  moneyGivenAmounts: string[] = [];
  moneyGivenDates: string[] = [];
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

  async addToReserve() {
    if (this.reserveAmount === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.reserveAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      let conf = confirm(
        ` Vous allez servir ${this.reserveAmount} FC pour demain/aujouduio. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      try {
        const updateManagement =
          await this.data.updateManagementInfoForMoneyGiven(this.reserveAmount);
        this.router.navigate(['/gestion-today']);
      } catch (err: any) {
        alert("Une erreur s'est produite lors de l'initialization, Réessayez");
        console.log('error ocorred while entering reserve amount', err);
        return;
      }
    }
  }
  getCurrentServed() {
    this.moneyGiven = this.managementInfo!.moneyGiven;

    let currentMoneyGiven = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.managementInfo!.moneyGiven!)
    );
    this.moneyGivenAmounts = currentMoneyGiven.map((entry) => entry[1]);
    this.moneyGivenDates = currentMoneyGiven.map((entry) =>
      this.time.convertTimeFormat(entry[0])
    );
  }
}
