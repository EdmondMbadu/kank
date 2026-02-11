import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-gestion-fraude',
  templateUrl: './gestion-fraude.component.html',
  styleUrls: ['./gestion-fraude.component.css'],
})
export class GestionFraudeComponent {
  fraudAmount: string = '';
  fraudReason: string = '';
  fraudes: any = [];
  currentFraudes: [string, string][] = [];
  fraudAmounts: string[] = [];
  fraudReasons: string[] = [];
  fraudDates: string[] = [];
  currentUser: any = {};
  managementInfo?: Management = {};
  showAllFraudes = false;

  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.getCurrentFraudes();
    });
  }

  addFraud() {
    if (this.fraudAmount === '' || this.fraudReason === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.fraudAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      const conf = confirm(
        `Vous ajoutez une fraude de ${this.fraudAmount} FC pour la raison "${this.fraudReason}". Voulez-vous continuer ?`
      );
      if (!conf) {
        return;
      }
      this.data.updateManagementInfoForAddFraud(
        this.fraudAmount,
        this.fraudReason
      );
      this.router.navigate(['/gestion-today']);
    }
  }

  getCurrentFraudes() {
    this.fraudes = this.managementInfo?.fraudes || {};
    this.currentFraudes = Object.entries(this.managementInfo?.fraudes || {});
    this.currentFraudes = this.compute.sortArrayByDateDescendingOrder(
      this.currentFraudes
    );

    this.fraudReasons = this.currentFraudes.map((entry) => entry[1]);
    this.fraudDates = this.currentFraudes.map((entry) =>
      this.time.convertTimeFormat(entry[0])
    );
    this.fraudAmounts = this.fraudReasons.map((item) => item.split(':')[0]);
    this.fraudReasons = this.fraudReasons.map((item) => item.split(':')[1]);
  }

  hasMoreFraudes(): boolean {
    return this.currentFraudes.length > 3;
  }
}
