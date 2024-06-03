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
      this.findAgent();
      console.log(' the client itself', this.client);
      console.log('client agent during', this.client.agent);
      console.log('agent clients before', this.agent?.clients);
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
      console.log('agent clients after', this.agent?.clients);
    }
  }
  // update the clients array on the previous agent side
  updatePreviousClientAgentInfo() {
    console.log('previous client agent', this.previousClientAgent);
    if (
      this.previousClientAgent !== 'Choose' &&
      this.previousClientAgent !== undefined &&
      this.previousClientAgent !== this.client.agent
    ) {
      let employee = this.findAgentWithId(this.previousClientAgent);
      console.log('the employee', employee);
      employee!.clients = employee?.clients?.filter(
        (element) => element !== this.client.uid
      );
      this.data.updateEmployeeInfoForClientAgentAssignment(employee!);
    }
  }
}
