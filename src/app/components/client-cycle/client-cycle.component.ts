import { Component } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

@Component({
  selector: 'app-client-cycle',
  templateUrl: './client-cycle.component.html',
  styleUrls: ['./client-cycle.component.css'],
})
export class ClientCycleComponent {
  client = new Client();
  clientCycles: Client[] = [];
  clientCycle = new Client();
  minPay = '';
  employees: Employee[] = [];
  agent?: Employee = { firstName: '-' };
  url: string = '';
  public graphCredit = {
    data: [
      {
        domain: { x: [0, 1], y: [0, 1] },
        value: 270,
        title: { text: 'Speed' },
        type: 'indicator',
        mode: 'gauge+number',
        gauge: {
          axis: { range: [0, 100], tickcolor: 'blue' }, // Color of the ticks (optional)
          bar: { color: 'blue' }, // Single color for the gauge bar (needle)
        },
      },
    ],
    layout: {
      margin: { t: 0, b: 0, l: 0, r: 0 }, // Adjust margins
      responsive: true, // Make the chart responsive
    },
  };

  id: any = '';
  clientId: any = '';
  cycleId: any = '';
  paymentDate = '';
  debtStart = '';
  debtEnd = '';
  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private time: TimeService,
    private data: DataService,
    private compute: ComputationService,
    private storage: AngularFireStorage
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
    const [ci, cy] = this.id.split('-');
    this.clientId = ci;
    this.cycleId = cy;
  }
  ngOnInit(): void {
    this.retrieveClientCycle();
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.findAgent();
    });
  }
  findAgent() {
    for (let em of this.employees) {
      if (this.client.agent !== undefined && this.client.agent === em.uid) {
        this.agent = em;
      }
    }
  }

  retrieveClientCycle(): void {
    this.auth.getClient(this.clientId).subscribe((data: any) => {
      this.clientCycle = data;
      this.data
        .getClientCycle(this.clientId, this.cycleId)
        .subscribe((dataC) => {
          this.client = dataC;
          console.log('Current client', this.client);
          this.minimumPayment();
          this.client.frenchPaymentDay = this.time.translateDayInFrench(
            this.client.paymentDay!
          );
          this.setGraphCredit();

          this.paymentDate = this.time.nextPaymentDate(this.client.dateJoined);
          this.debtStart = this.time.formatDateString(
            this.client.debtCycleStartDate
          );
          this.debtEnd = this.time.formatDateString(this.endDate());
          this.retrieveEmployees();
        });
    });
  }

  setGraphCredit() {
    let num = Number(this.client.creditScore);
    let gaugeColor = this.compute.getGradientColor(Number(num));

    this.graphCredit = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: {
            text: `Client Score Credit`,
          },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor }, // Color of the ticks (optional)
            bar: { color: gaugeColor }, // Single color for the gauge bar (needle)
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 }, // Adjust margins
        responsive: true, // Make the chart responsive
      },
    };
  }

  endDate() {
    return Number(this.client.paymentPeriodRange) === 8
      ? this.time.getDateInNineWeeks(this.client.debtCycleStartDate!)
      : this.time.getDateInFiveWeeks(this.client.debtCycleStartDate!);
  }

  minimumPayment() {
    const pay =
      Number(this.client.amountToPay) / Number(this.client.paymentPeriodRange);
    this.minPay = pay.toString();
  }
}
