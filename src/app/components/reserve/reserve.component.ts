import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-reserve',
  templateUrl: './reserve.component.html',
  styleUrls: ['./reserve.component.css'],
})
export class ReserveComponent {
  reserveAmount: string = '';
  reserve: string[] = [];
  reserveAmounts: string[] = [];
  reserveDates: string[] = [];
  currentUser: any = {};
  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.getCurrentUser();
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
        const userInfo = await this.data.updateUserInfoForAddToReserve(
          this.reserveAmount
        );
        // the testing platform to not count here as well
        if (this.auth.currentUser.mode !== 'testing') {
          const updateManagement =
            await this.data.updateManagementInfoForAddToReserve(
              this.reserveAmount
            );
        }

        this.router.navigate(['/home']);
      } catch (err: any) {
        alert("Une erreur s'est produite lors de l'initialization, Réessayez");
        console.log('error ocorred while entering reserve amount', err);
        return;
      }
    }
  }
  getCurrentUser() {
    this.auth.user$.subscribe((user) => {
      this.currentUser = user;
      this.reserve = this.currentUser.reserve;

      let currentreserve = this.compute.sortArrayByDateDescendingOrder(
        Object.entries(this.currentUser.reserve)
      );
      this.reserveAmounts = currentreserve.map((entry) => entry[1]);
      this.reserveDates = currentreserve.map((entry) =>
        this.time.convertTimeFormat(entry[0])
      );
    });
  }
}
