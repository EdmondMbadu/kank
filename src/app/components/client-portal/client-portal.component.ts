import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
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
  employees: Employee[] = [];
  agent?: Employee = { firstName: '-' };

  id: any = '';
  paymentDate = '';
  debtStart = '';
  debtEnd = '';
  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private time: TimeService,
    private data: DataService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();

    this.retrieveEmployees();
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

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      this.minimumPayment();
      this.client.frenchPaymentDay = this.time.translateDayInFrench(
        this.client.paymentDay!
      );

      this.paymentDate = this.time.nextPaymentDate(this.client.dateJoined);
      this.debtStart = this.time.formatDateString(
        this.client.debtCycleStartDate
      );
      this.debtEnd = this.time.formatDateString(this.endDate());
    });
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

  startNewDebtCycle() {
    if (this.client.amountPaid !== this.client.amountToPay) {
      alert(
        `Vous devez encore FC ${this.client.debtLeft}. Terminez d'abord ce cycle.`
      );
      return;
    } else {
      this.router.navigate(['/new-cycle-register/' + this.id]);
    }
  }
  withDrawFromSavings() {
    if (this.client.savings === '0') {
      alert("Vous n'avez pas d'argent d'epargnes!");
      return;
    } else {
      this.router.navigate(['/withdraw-savings/' + this.id]);
    }
  }
  requestWithDrawFromSavings() {
    if (this.client.savings === '0') {
      alert("Vous n'avez pas d'argent d'epargnes!");
      return;
    } else {
      this.router.navigate(['/request-savings-withdraw/' + this.id]);
    }
  }

  delete() {
    let result = confirm('Êtes-vous sûr de vouloir supprimer ce client?');
    if (!result) {
      return;
    }
    this.auth
      .deleteClient(this.client)
      .then(() => {
        alert('Client supprimé avec succès !');
        this.router.navigate(['/client-info/']);
      })
      .catch((error) => {
        alert('Error deleting client: ');
      });

    this.auth
      .UpdateUserInfoForDeletedClient(this.client)
      .then(() => {
        console.log('updated user info');
      })
      .catch((error) => {
        alert('Error deleting client: ');
      });
    this.removeClientFromAgentList();
  }

  removeClientFromAgentList() {
    this.agent!.clients = this.agent?.clients?.filter(
      (element) => element !== this.client.uid
    );

    this.data
      .updateEmployeeInfoForClientAgentAssignment(this.agent!)
      .then(() => console.log('agent clients list updated succesfully.'));
  }
}
