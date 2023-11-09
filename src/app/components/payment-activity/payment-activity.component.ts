import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-payment-activity',
  templateUrl: './payment-activity.component.html',
  styleUrls: ['./payment-activity.component.css'],
})
export class PaymentActivityComponent implements OnInit {
  id: any = '';
  client: Client = new Client();
  public payments: string[] = [];
  public paymentDates: string[] = [];
  public formattedPaymentsDates: string[] = [];
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private time: TimeService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit() {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      // this.payments = Object.values(this.client.payments!);
      // this.paymentDates = Object.keys(this.client.payments!);
      const paymentsArray = Object.entries(this.client.payments!);

      // Sort the array by date in descending order
      paymentsArray.sort((a, b) => {
        // Convert date strings to Date objects
        const dateA = new Date(
          a[0].replace(
            /(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-(\d+)/,
            '$1/$2/$3 $4:$5:$6'
          )
        );
        const dateB = new Date(
          b[0].replace(
            /(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-(\d+)/,
            '$1/$2/$3 $4:$5:$6'
          )
        );
        return dateB.getTime() - dateA.getTime(); // Sort in descending order
      });

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
