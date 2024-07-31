import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-reserve',
  templateUrl: './gestion-reserve.component.html',
  styleUrls: ['./gestion-reserve.component.css'],
})
export class GestionReserveComponent {
  reserveAmount: string = '';
  reserve: any = [];
  reserveAmounts: string[] = [];
  reserveDates: string[] = [];
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
      this.getCurrentReserve();
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
        ` Vous ajouter dans la reserve ${this.reserveAmount} FC. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      try {
        const updateManagement =
          await this.data.updateManagementInfoForAddToReserve(
            this.reserveAmount
          );
        this.router.navigate(['/gestion-today']);
      } catch (err: any) {
        alert("Une erreur s'est produite lors de l'initialization, Réessayez");
        console.log('error ocorred while entering reserve amount', err);
        return;
      }
    }
  }
  getCurrentReserve() {
    this.reserve = this.managementInfo!.reserve;

    let currentreserve = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(this.managementInfo!.reserve!)
    );
    this.reserveAmounts = currentreserve.map((entry) => entry[1]);
    this.reserveDates = currentreserve.map((entry) =>
      this.time.convertTimeFormat(entry[0])
    );
  }
}
