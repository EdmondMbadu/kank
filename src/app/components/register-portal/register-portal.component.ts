import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-register-portal',
  templateUrl: './register-portal.component.html',
  styleUrls: ['./register-portal.component.css'],
})
export class RegiserPortalComponent {
  client = new Client();
  minPay = '';
  employees: Employee[] = [];
  agent?: Employee = { firstName: '-' };

  id: any = '';
  paymentDate = '';
  debtStart = '';
  requestDate = '';
  debtEnd = '';
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
  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private time: TimeService,
    private data: DataService,
    private compute: ComputationService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      this.setGraphCredit();
      this.client.debtCycle =
        this.client.debtCycle === undefined || this.client.debtCycle === '0'
          ? '1'
          : this.client.debtCycle;
      this.requestDate = this.time.convertDateToDayMonthYear(
        this.client.requestDate!
      );
    });
  }

  startNewDebtCycle() {
    if (this.client.amountPaid !== this.client.amountToPay) {
      alert(
        `Vous devez encore FC ${this.client.debtLeft}. Terminez d'abord ce cycle.`
      );
      return;
    } else {
      this.router.navigate(['/debt-cycle/' + this.id]);
    }
  }
  withDrawFromSavings() {
    if (this.client.savings === '0') {
      alert("Vous n'avez pas d'argent !");
      return;
    } else {
      this.router.navigate(['/withdraw-savings/' + this.id]);
    }
  }

  // delete() {
  //   let result = confirm('Êtes-vous sûr de vouloir supprimer ce client?');
  //   if (!result) {
  //     return;
  //   }
  //   this.auth
  //     .deleteClient(this.client)
  //     .then(() => {
  //       alert('Client supprimé avec succès !');
  //       this.router.navigate(['/client-info/']);
  //     })
  //     .catch((error) => {
  //       alert('Error deleting client: ');
  //     });

  //   this.auth
  //     .UpdateUserInfoForDeletedRegisterClient(this.client)
  //     .then(() => {
  //       console.log('updated user info');
  //     })
  //     .catch((error) => {
  //       alert('Error deleting client: ');
  //     });
  // }

  async cancelRegistration() {
    let total =
      Number(this.client.savings) +
      Number(this.client.membershipFee) +
      Number(this.client.applicationFee);
    let result = confirm(
      `Êtes-vous sûr de vouloir annuler l'enregistrement?. Cela entraînera le retour de tout l'argent aux clients pour un total de ${total} FC`
    );
    if (!result) {
      return;
    }

    try {
      this.client.applicationFeePayments = {
        [this.time.todaysDate()]:
          Number(this.client.applicationFee) > 0
            ? `-${this.client.applicationFee}`
            : `${this.client.applicationFee}`,
      };

      this.client.membershipFeePayments = {
        [this.time.todaysDate()]:
          Number(this.client.membershipFee) > 0
            ? `-${this.client.membershipFee}`
            : `${this.client.membershipFee}`,
      };
      this.client.savingsPayments = {
        [this.time.todaysDate()]:
          Number(this.client.savings) > 0
            ? `-${this.client.savings}`
            : `${this.client.savings}`,
      };
      const updateUser =
        await this.data.UpdateUserInfoForCancelingdRegisteredClient(
          this.client
        );
      const clientCancel = await this.auth.cancelClientRegistration(
        this.client
      );

      this.router.navigate(['/client-info-current/']);
    } catch (err) {
      console.log('error occured while cancelling registration', err);
      alert("Une erreur s'est de l'annulation de l'enregistrement, Réessayez");
      return;
    }
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
}
