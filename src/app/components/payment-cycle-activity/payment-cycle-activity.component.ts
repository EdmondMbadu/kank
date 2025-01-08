import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

@Component({
  selector: 'app-payment-cycle-activity',
  templateUrl: './payment-cycle-activity.component.html',
  styleUrls: ['./payment-cycle-activity.component.css'],
})
export class PaymentCycleActivityComponent implements OnInit {
  id: any = '';
  client: Client = new Client();
  clientCycle: Client = new Client();
  public payments: string[] = [];
  public paymentDates: string[] = [];
  public formattedPaymentsDates: string[] = [];
  clientId: any = '';
  cycleId: any = '';
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private data: DataService,
    private time: TimeService,
    private compute: ComputationService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
    const [ci, cy] = this.id.split('-');
    this.clientId = ci;
    this.cycleId = cy;
  }
  ngOnInit() {
    this.retrieveClientCycle();
  }

  retrieveClientCycle(): void {
    this.auth.getClient(this.clientId).subscribe((data: any) => {
      this.clientCycle = data;
      this.data
        .getClientCycle(this.clientId, this.cycleId)
        .subscribe((dataC) => {
          this.client = dataC;
          console.log(
            ' payment cycle activity component data here. ',
            this.client
          );

          let paymentsArray = Object.entries(this.client.payments!);
          paymentsArray =
            this.compute.sortArrayByDateDescendingOrder(paymentsArray);
          // Extract the sorted payment values and dates into separate arrays
          this.payments = paymentsArray.map((entry) => entry[1]);
          this.paymentDates = paymentsArray.map((entry) => entry[0]);
          this.formatPaymentDates();
        });
    });
  }
  formatPaymentDates() {
    for (let p of this.paymentDates) {
      this.formattedPaymentsDates.push(this.time.convertDateToDesiredFormat(p));
    }
  }
}
