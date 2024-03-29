import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-amount-invested',
  templateUrl: './amount-invested.component.html',
  styleUrls: ['./amount-invested.component.css'],
})
export class AmountInvestedComponent implements OnInit {
  investmentAddAmount: string = '';
  currentUser: any = {};
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
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.investmentAddAmount))) {
      alert('Enter a valid number!');
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
      this.currentUser = user;
      this.investments = this.currentUser.investments;
      this.investmentsDollar = this.currentUser.investmentsDollar;
      let investmentsArray = Object.entries(user.investments).map(
        ([key, value]): [string, string] => {
          // Convert the value to string if it's not already a string.
          // This is a basic conversion; adapt it if you need more complex handling.
          return [key, String(value)];
        }
      );

      investmentsArray =
        this.compute.sortArrayByDateDescendingOrder(investmentsArray);
      // Extract the sorted payment values and dates into separate arrays
      this.investments = investmentsArray.map((entry) => entry[1]);
      this.investmentsDates = investmentsArray.map((entry) => entry[0]);
      this.formatPaymentDates();
    });
  }

  formatPaymentDates() {
    for (let p of this.investmentsDates) {
      this.investmentsFormattedDates.push(
        this.time.convertDateToDesiredFormat(p)
      );
    }
  }
}
