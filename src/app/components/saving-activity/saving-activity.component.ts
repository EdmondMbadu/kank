import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-saving-activity',
  templateUrl: './saving-activity.component.html',
  styleUrls: ['./saving-activity.component.css'],
})
export class SavingActivityComponent implements OnInit {
  id: any = '';
  client: Client = new Client();
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
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];

      let savingsPaymentsArray = Object.entries(this.client.savingsPayments!);
      // remove the 0 amount savings ( means nothing)
      savingsPaymentsArray = savingsPaymentsArray.filter(
        (item: any) => item[1] !== 0 && item[1] !== '0'
      );

      savingsPaymentsArray =
        this.compute.sortArrayByDateDescendingOrder(savingsPaymentsArray);
      // Extract the sorted payment values and dates into separate arrays
      this.payments = savingsPaymentsArray.map((entry) => entry[1]);
      this.paymentDates = savingsPaymentsArray.map((entry) => entry[0]);
      this.formatPaymentDates();
    });
  }
  formatPaymentDates() {
    for (let p of this.paymentDates) {
      this.formattedPaymentsDates.push(this.time.convertDateToDesiredFormat(p));
    }
  }
}
