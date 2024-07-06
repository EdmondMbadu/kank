import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
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
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      this.client.debtCycle =
        this.client.debtCycle === undefined ? '1' : this.client.debtCycle;
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
      .UpdateUserInfoForDeletedRegisterClient(this.client)
      .then(() => {
        console.log('updated user info');
      })
      .catch((error) => {
        alert('Error deleting client: ');
      });
  }
}
