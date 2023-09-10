import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-client-portal',
  templateUrl: './client-portal.component.html',
  styleUrls: ['./client-portal.component.css'],
})
export class ClientPortalComponent {
  client = new Client();
  minPay = '';
  aRemaining = '';
  id: any = '';
  paymentDate = '';
  debtStart = '';
  debtEnd = '';
  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private data: DataService,
    private time: TimeService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
    console.log('current id', this.id);
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      this.minimumPayment();
      this.amountRemaining();
      this.paymentDate = this.time.nextPaymentDate(this.client.dateJoined);
      this.debtStart = this.time.formatDateString(
        this.client.debtCycleStartDate
      );
      this.debtEnd = this.time.formatDateString(this.client.debtCycleEndDate);
    });
  }

  minimumPayment() {
    const pay =
      Number(this.client.amountToPay) / Number(this.client.paymentPeriodRange);
    this.minPay = pay.toString();
  }

  amountRemaining() {
    const pay =
      Number(this.client.amountToPay) - Number(this.client.amountPaid);
    this.aRemaining = pay.toString();
  }

  startNewDebtCycle() {
    if (this.client.amountPaid !== this.client.amountToPay) {
      alert(`You still owe FC ${this.aRemaining}. Finish this cycle first.`);
      return;
    } else {
      this.router.navigate(['/debt-cycle/' + this.id]);
    }
  }
  withDrawFromSavings() {
    if (this.client.savings === '0') {
      alert('You have have no Money!');
      return;
    } else {
      this.router.navigate(['/withdraw-savings/' + this.id]);
    }
  }
}
