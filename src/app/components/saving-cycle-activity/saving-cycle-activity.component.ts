import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

@Component({
  selector: 'app-saving-cycle-activity',
  templateUrl: './saving-cycle-activity.component.html',
  styleUrls: ['./saving-cycle-activity.component.css'],
})
export class SavingCycleActivityComponent implements OnInit {
  id: any = '';
  clientId: any = '';
  cycleId: any = '';
  client: Client = new Client();
  clientCycle: Client = new Client();
  public payments: string[] = [];
  public paymentDates: string[] = [];
  public formattedPaymentsDates: string[] = [];

  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private data: DataService
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
          let savingsPaymentsArray = Object.entries(
            this.client.savingsPayments!
          );
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
    });
  }

  formatPaymentDates() {
    for (let p of this.paymentDates) {
      this.formattedPaymentsDates.push(this.time.convertDateToDesiredFormat(p));
    }
  }
}
