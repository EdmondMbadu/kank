import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';

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
  constructor(public auth: AuthService, public activatedRoute: ActivatedRoute) {
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
      this.nextPaymentDate(this.client.dateJoined);
    });
  }

  minimumPayment() {
    const pay =
      (Number(this.client.loanAmount) + Number(this.client.loanAmount) * 0.4) /
      8;
    this.minPay = pay.toString();
  }

  amountRemaining() {
    const pay = Number(this.client.loanAmount) - Number(this.client.amountPaid);
    this.aRemaining = pay.toString();
  }
  nextPaymentDate(dateJoined: any) {
    const targetDay = new Date(dateJoined).getDay();
    if (targetDay < 0 || targetDay > 6) {
      throw new Error('Invalid day: the day parameter must be between 0 and 6');
    }

    let today = new Date();
    let dayOfWeek = today.getDay();
    let daysUntilTargetDay = (targetDay - dayOfWeek + 7) % 7;

    // If the target day is today, we want the date for the same day in the next week
    if (daysUntilTargetDay === 0) {
      daysUntilTargetDay = 7;
    }

    today.setDate(today.getDate() + daysUntilTargetDay);
    today.setHours(0, 0, 0, 0); // Reset hours, minutes, seconds and milliseconds

    const format = today.toDateString().split(' ');
    this.paymentDate = format[1] + ' ' + format[2];
  }
}
