import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-payment-activity-card',
  templateUrl: './payment-activity-card.component.html',
  styleUrls: ['./payment-activity-card.component.css'],
})
export class PaymentActivityCardComponent implements OnInit {
  id: any = '';
  clientCard: Card = new Card();
  public payments: string[] = [];
  public paymentDates: string[] = [];
  public formattedPaymentsDates: string[] = [];
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit() {
    this.retrieveClientCard();
  }

  retrieveClientCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.clientCard = data[Number(this.id)];
      // this.payments = Object.values(this.client.payments!);
      // this.paymentDates = Object.keys(this.client.payments!);
      let paymentsArray = Object.entries(this.clientCard.payments!);
      paymentsArray =
        this.compute.sortArrayByDateDescendingOrder(paymentsArray);
      // Extract the sorted payment values and dates into separate arrays
      this.payments = paymentsArray.map((entry) => entry[1]);
      this.paymentDates = paymentsArray.map((entry) => entry[0]);
      this.formatPaymentDates();
    });
  }
  formatPaymentDates() {
    for (let p of this.paymentDates) {
      this.formattedPaymentsDates.push(this.time.convertDateToDesiredFormat(p));
    }
  }
}
