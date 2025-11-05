import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

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

          // Sort by dateKey in descending order (newest first) with correct date parsing
          savingsPaymentsArray.sort((a, b) => {
            const timestampA = this.getTimestampFromDateKey(a[0]);
            const timestampB = this.getTimestampFromDateKey(b[0]);
            return timestampB - timestampA; // Descending order (newest first)
          });

          // Extract the sorted payment values and dates into separate arrays
          this.payments = savingsPaymentsArray.map((entry) => entry[1]);
          this.paymentDates = savingsPaymentsArray.map((entry) => entry[0]);
          this.formatPaymentDates();
        });
    });
  }

  // Helper method to convert dateKey to timestamp for sorting
  // dateKey format: M-D-YYYY-HH-mm-ss (month-day-year-hour-minute-second)
  private getTimestampFromDateKey(dateKey: string): number {
    if (!dateKey) {
      return 0;
    }

    const parts = dateKey.split('-');
    if (parts.length < 3) {
      return 0;
    }

    // Format: month-day-year-hour-minute-second
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const hour = parts.length > 3 ? parseInt(parts[3], 10) : 0;
    const minute = parts.length > 4 ? parseInt(parts[4], 10) : 0;
    const second = parts.length > 5 ? parseInt(parts[5], 10) : 0;

    const timestamp = new Date(
      year,
      month - 1, // month is 0-indexed in Date constructor
      day,
      hour,
      minute,
      second
    ).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  formatPaymentDates() {
    for (let p of this.paymentDates) {
      this.formattedPaymentsDates.push(this.time.convertDateToDesiredFormat(p));
    }
  }
}
