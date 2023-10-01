import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-withdraw-savings',
  templateUrl: './withdraw-savings.component.html',
  styleUrls: ['./withdraw-savings.component.css'],
})
export class WithdrawSavingsComponent implements OnInit {
  id: any = '';
  paymentOtherAmount: boolean = false;
  savingsOtherAmount: boolean = false;
  savingsWithdrawn: string = '';
  client: Client = new Client();
  constructor(
    private router: Router,
    public auth: AuthService,
    private data: DataService,
    private activatedRoute: ActivatedRoute,
    private time: TimeService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
    });
  }
  displaySavingsOtherAmount() {
    if (this.savingsWithdrawn === 'Other Amount') {
      this.savingsOtherAmount = true;
      this.savingsWithdrawn = '';
    } else {
      this.savingsOtherAmount = false;
    }
  }
  makePayment() {
    if (this.savingsWithdrawn === '') {
      alert('FIll all fields');
      return;
    } else if (Number.isNaN(Number(this.savingsWithdrawn))) {
      alert('Incorrect input. Enter a number');
      return;
    } else if (Number(this.savingsWithdrawn) > Number(this.client.savings)) {
      alert('Not Enough Money!');
      return;
    } else if (Number(this.savingsWithdrawn) <= 0) {
      alert('Withraw a valid amount!');
      return;
    } else {
      this.client.savings = (
        Number(this.client.savings) - Number(this.savingsWithdrawn)
      ).toString();
      this.client.savingsPayments = {
        [this.time.todaysDate()]: `-${this.savingsWithdrawn}`,
      };

      this.data.clientWithdrawFromSavings(this.client, this.savingsWithdrawn);
      this.router.navigate(['/client-portal/' + this.id]);
    }
  }
}
