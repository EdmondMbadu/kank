import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-update-client-info',
  templateUrl: './update-client-info.component.html',
  styleUrls: ['./update-client-info.component.css'],
})
export class UpdateClientInfoComponent {
  id: any = '';
  middleName: string = '';
  client = new Client();
  agent?: Employee = {};
  previousClientAgent?: string;
  employees: Employee[] = [];

  private originalPhoneNumber?: string;
  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private data: DataService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
    this.retrieveEmployees();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      this.previousClientAgent = this.client.agent!;
      this.originalPhoneNumber = this.client.phoneNumber || ''; // 👈 keep the original
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
    });
  }
  findAgent() {
    for (let em of this.employees) {
      if (this.client.agent !== undefined && this.client.agent === em.uid) {
        this.agent = em;
      }
    }
  }
  /** compare numbers without spaces/dashes/etc. */
  private normalizePhone(p?: string): string {
    return (p || '').replace(/\D+/g, ''); // digits only
  }

  findAgentWithId(id: string) {
    for (let em of this.employees) {
      if (em.uid === id) {
        return em;
      }
    }
    return null;
  }

  updateClientInfo() {
    if (this.client.middleName === undefined) {
      this.client.middleName = this.middleName;
    }
    if (
      this.client.firstName === '' ||
      this.client.lastName === '' ||
      this.client.middleName === '' ||
      this.client.phoneNumber === '' ||
      this.client.businessAddress === '' ||
      this.client.businessAddress === '' ||
      this.client.profession === '' ||
      this.client.paymentDay === '' ||
      this.client.agent === undefined ||
      this.client.agent === 'Choose'
    ) {
      alert('Completer toutes les données');
      return;
    } else {
      // ✅ Add old phone to the history if it changed and isn't already there
      const oldNorm = this.normalizePhone(this.originalPhoneNumber);
      const newNorm = this.normalizePhone(this.client.phoneNumber);
      if (oldNorm && newNorm && oldNorm !== newNorm) {
        const list = Array.isArray(this.client.previousPhoneNumbers)
          ? [...this.client.previousPhoneNumbers]
          : [];

        const alreadyInList = list.some(
          (p) => this.normalizePhone(p) === oldNorm
        );

        if (!alreadyInList && this.originalPhoneNumber) {
          list.push(this.originalPhoneNumber); // store the exact old formatting
        }

        this.client.previousPhoneNumbers = list;
      }

      this.findAgent();
      this.updateAgentClients();
      this.updatePreviousClientAgentInfo();
      this.data.updateClientInfo(this.client).then(() => {
        this.data.updateEmployeeInfoForClientAgentAssignment(this.agent!);
      });
      this.router.navigate(['/client-portal/' + this.id]);
    }
  }
  updateAgentClients() {
    if (
      this.client!.agent !== undefined &&
      this.agent?.clients !== undefined &&
      !this.agent!.clients!.includes(this.client.uid!)
    ) {
      this.agent?.clients?.push(this.client.uid!);
    }
  }
  // update the clients array on the previous agent side
  updatePreviousClientAgentInfo() {
    if (
      this.previousClientAgent !== 'Choose' &&
      this.previousClientAgent !== undefined &&
      this.previousClientAgent !== this.client.agent
    ) {
      let employee = this.findAgentWithId(this.previousClientAgent);

      employee!.clients = employee?.clients?.filter(
        (element) => element !== this.client.uid
      );
      this.data.updateEmployeeInfoForClientAgentAssignment(employee!);
    }
  }
}
