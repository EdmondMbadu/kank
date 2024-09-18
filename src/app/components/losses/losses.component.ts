import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-losses',
  templateUrl: './losses.component.html',
  styleUrls: ['./losses.component.css'],
})
export class LossesComponent {
  lossAmount: string = '';
  lossReason: string = '';
  losses: string[] = [];
  currentLosses: [string, string][] = [];
  lossesAmounts: string[] = [];
  lossesReasons: string[] = [];
  lossesDates: string[] = [];
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

  addLosses() {
    if (this.lossAmount === '' || this.lossReason === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.lossAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      let conf = confirm(
        ` Vous ajouter dans la perte ${this.lossAmount} FC pour la  raison de ${this.lossReason}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.data.updateUserInfoForAddLoss(this.lossAmount, this.lossReason);
      this.router.navigate(['/home']);
    }
  }
  getCurrentUser() {
    this.auth.user$.subscribe((user) => {
      this.currentUser = user;
      this.losses = this.currentUser.losses;
      this.currentLosses = Object.entries(this.currentUser.losses);
      this.currentLosses = this.compute.sortArrayByDateDescendingOrder(
        this.currentLosses
      );

      this.lossesReasons = this.currentLosses.map((entry) => entry[1]);
      this.lossesDates = this.currentLosses.map((entry) =>
        this.time.convertTimeFormat(entry[0])
      );
      this.lossesAmounts = this.lossesReasons.map((item) => item.split(':')[0]);
      this.lossesReasons = this.lossesReasons.map((item) => item.split(':')[1]);
    });
  }
}
