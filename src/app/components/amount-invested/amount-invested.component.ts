import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

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
  public paymentDates: string[] = [];

  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router
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
    } else {
      this.data.updateUserInfoForAddInvestment(this.investmentAddAmount);
      this.router.navigate(['/home']);
    }
  }
  getCurrentUser() {
    this.auth.user$.subscribe((user) => {
      this.currentUser = user;
      this.investments = this.currentUser.investments;
    });
  }
}
