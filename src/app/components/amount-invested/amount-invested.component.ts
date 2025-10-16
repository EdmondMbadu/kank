import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { FormControl } from '@angular/forms';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { User } from 'src/app/models/user';

@Component({
  selector: 'app-amount-invested',
  templateUrl: './amount-invested.component.html',
  styleUrls: ['./amount-invested.component.css'],
})
export class AmountInvestedComponent implements OnInit {
  investmentAddAmount: string = '';
  currentUser: User | null = null;
  searchControl = new FormControl();
  public investments: string[] = [];
  public investmentsDollar: string[] = [];
  investmentsDates: string[] = [];
  public paymentDates: string[] = [];
  public investmentsFormattedDates: string[] = [];

  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.getCurrentUser();
  }

  ngOnInit(): void {}
  addInvestment() {
    if (this.investmentAddAmount === '') {
      alert('Remplissez toutes les données!');
      return;
    } else if (isNaN(Number(this.investmentAddAmount))) {
      alert('Entrez un nombre valide!');
      return;
    } else {
      let conf = confirm(
        ` Vous ajouter un montant de ${this.investmentAddAmount} FC pour l'investissement. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.data.updateUserInfoForAddInvestment(this.investmentAddAmount);
      this.router.navigate(['/home']);
    }
  }
  getCurrentUser() {
    this.auth.user$.subscribe((user) => {
      this.currentUser = user ?? null;

      const investments = this.currentUser?.investments ?? {};
      const investmentsDollar = this.currentUser?.investmentsDollar ?? {};

      let investmentsArray = Object.entries(investments).map(
        ([key, value]): [string, string] => [key, String(value)]
      );

      investmentsArray =
        this.compute.sortArrayByDateDescendingOrder(investmentsArray);

      this.investments = investmentsArray.map((entry) => entry[1]);
      this.investmentsDates = investmentsArray.map((entry) => entry[0]);
      this.investmentsDollar = Object.values(investmentsDollar).map((value) =>
        String(value)
      );
      this.formatPaymentDates();
    });
  }

  formatPaymentDates() {
    this.investmentsFormattedDates = this.investmentsDates.map((date) =>
      this.time.convertDateToDesiredFormat(date)
    );
  }
}
