import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
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

  addToReserve() {
    if (this.reserveAmount === '') {
      alert('Fill all fields!');
      return;
    } else if (isNaN(Number(this.reserveAmount))) {
      alert('Enter a valid number!');
      return;
    } else {
      this.data.updateUserInfoForAddToReserve(this.reserveAmount);
      this.router.navigate(['/home']);
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
