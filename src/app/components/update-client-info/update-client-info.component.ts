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
    console.log('🔵 [NG ON INIT] Component initialized');
    console.log('🔵 [NG ON INIT] Client ID from route:', this.id);
    this.retrieveClient();
    this.retrieveEmployees();
  }

  retrieveClient(): void {
    console.log('🔵 [RETRIEVE CLIENT] Starting to retrieve client with ID:', this.id);
    this.auth.getAllClients().subscribe((data: any) => {
      console.log('🔵 [RETRIEVE CLIENT] All clients received, count:', data?.length);
      console.log('🔵 [RETRIEVE CLIENT] Looking for client at index:', Number(this.id));
      this.client = data[Number(this.id)];
      console.log('🔵 [RETRIEVE CLIENT] Client retrieved:', this.client);
      console.log('🔵 [RETRIEVE CLIENT] Client agent:', this.client?.agent);
      this.previousClientAgent = this.client.agent!;
      console.log('🔵 [RETRIEVE CLIENT] Previous client agent:', this.previousClientAgent);
      this.originalPhoneNumber = this.client.phoneNumber || ''; // 👈 keep the original
      console.log('🔵 [RETRIEVE CLIENT] Original phone number:', this.originalPhoneNumber);
    });
  }
  retrieveEmployees(): void {
    console.log('🔵 [RETRIEVE EMPLOYEES] Starting to retrieve employees');
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      console.log('🔵 [RETRIEVE EMPLOYEES] Employees retrieved, count:', this.employees?.length);
      console.log('🔵 [RETRIEVE EMPLOYEES] Employees:', this.employees);
    });
  }
  findAgent() {
    console.log('🔵 [FIND AGENT] Starting to find agent');
    console.log('🔵 [FIND AGENT] Client agent value:', this.client.agent);
    console.log('🔵 [FIND AGENT] Employees to search:', this.employees.length);
    
    let found = false;
    for (let em of this.employees) {
      console.log('🔵 [FIND AGENT] Checking employee:', em.firstName, em.lastName, 'UID:', em.uid);
      if (this.client.agent !== undefined && this.client.agent === em.uid) {
        console.log('✅ [FIND AGENT] Agent found!', em);
        this.agent = em;
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.error('❌ [FIND AGENT] Agent not found in employees list!');
      console.error('❌ [FIND AGENT] Client agent value:', this.client.agent);
      console.error('❌ [FIND AGENT] Available employee UIDs:', this.employees.map(e => e.uid));
    }
  }
  /** compare numbers without spaces/dashes/etc. */
  private normalizePhone(p?: string): string {
    return (p || '').replace(/\D+/g, ''); // digits only
  }

  findAgentWithId(id: string) {
    console.log('🔵 [FIND AGENT WITH ID] Looking for agent with ID:', id);
    for (let em of this.employees) {
      if (em.uid === id) {
        console.log('✅ [FIND AGENT WITH ID] Agent found:', em);
        return em;
      }
    }
    console.error('❌ [FIND AGENT WITH ID] Agent not found with ID:', id);
    return null;
  }

  async updateClientInfo(): Promise<void> {
    console.log('🔵 [UPDATE CLIENT INFO] Method called');
    console.log('🔵 [UPDATE CLIENT INFO] Client ID:', this.id);
    console.log('🔵 [UPDATE CLIENT INFO] Client object:', this.client);
    console.log('🔵 [UPDATE CLIENT INFO] Client agent value:', this.client.agent);
    console.log('🔵 [UPDATE CLIENT INFO] Employees array length:', this.employees.length);
    console.log('🔵 [UPDATE CLIENT INFO] Employees:', this.employees);
    
    if (this.client.middleName === undefined) {
      console.log('🔵 [UPDATE CLIENT INFO] Setting middleName from component property');
      this.client.middleName = this.middleName;
    }
    
    // Log validation checks
    console.log('🔵 [UPDATE CLIENT INFO] Validation checks:');
    console.log('  - firstName:', this.client.firstName, 'empty?', this.client.firstName === '');
    console.log('  - lastName:', this.client.lastName, 'empty?', this.client.lastName === '');
    console.log('  - middleName:', this.client.middleName, 'empty?', this.client.middleName === '');
    console.log('  - phoneNumber:', this.client.phoneNumber, 'empty?', this.client.phoneNumber === '');
    console.log('  - businessAddress:', this.client.businessAddress, 'empty?', this.client.businessAddress === '');
    console.log('  - profession:', this.client.profession, 'empty?', this.client.profession === '');
    console.log('  - paymentDay:', this.client.paymentDay, 'empty?', this.client.paymentDay === '');
    console.log('  - agent:', this.client.agent, 'undefined?', this.client.agent === undefined, 'Choose?', this.client.agent === 'Choose');
    
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
      console.log('❌ [UPDATE CLIENT INFO] Validation failed - showing alert');
      alert('Completer toutes les données');
      return;
    } else {
      console.log('✅ [UPDATE CLIENT INFO] Validation passed, proceeding with update');
      
      // ✅ Add old phone to the history if it changed and isn't already there
      const oldNorm = this.normalizePhone(this.originalPhoneNumber);
      const newNorm = this.normalizePhone(this.client.phoneNumber);
      console.log('🔵 [UPDATE CLIENT INFO] Phone number check - old:', oldNorm, 'new:', newNorm);
      
      if (oldNorm && newNorm && oldNorm !== newNorm) {
        console.log('🔵 [UPDATE CLIENT INFO] Phone number changed, updating history');
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

      console.log('🔵 [UPDATE CLIENT INFO] Finding agent with ID:', this.client.agent);
      this.findAgent();
      console.log('🔵 [UPDATE CLIENT INFO] Agent found:', this.agent);
      console.log('🔵 [UPDATE CLIENT INFO] Agent UID:', this.agent?.uid);
      console.log('🔵 [UPDATE CLIENT INFO] Agent firstName:', this.agent?.firstName);
      
      if (!this.agent || !this.agent.uid) {
        console.error('❌ [UPDATE CLIENT INFO] Agent not found! Agent is:', this.agent);
        alert('Agent non trouvé. Veuillez sélectionner un agent valide.');
        return;
      }
      
      console.log('🔵 [UPDATE CLIENT INFO] Updating agent clients');
      this.updateAgentClients();
      console.log('🔵 [UPDATE CLIENT INFO] Updating previous client agent info');
      this.updatePreviousClientAgentInfo();
      
      console.log('🔵 [UPDATE CLIENT INFO] Calling data.updateClientInfo');
      try {
        await this.data.updateClientInfo(this.client);
        console.log('✅ [UPDATE CLIENT INFO] Client info updated successfully');
        console.log('🔵 [UPDATE CLIENT INFO] Updating employee info for agent assignment');
        void this.data
          .updateEmployeeInfoForClientAgentAssignment(this.agent!)
          .then(() => {
            console.log('✅ [UPDATE CLIENT INFO] Employee info updated successfully');
          })
          .catch((err) => {
            console.error('❌ [UPDATE CLIENT INFO] Error updating employee info:', err);
          });

        console.log('🔵 [UPDATE CLIENT INFO] Navigating to client portal');
        await this.router.navigate(['/client-portal/' + this.id]);
      } catch (err) {
        console.error('❌ [UPDATE CLIENT INFO] Error updating client info:', err);
        alert('Erreur lors de la mise à jour des informations du client');
      }
    }
  }
  updateAgentClients() {
    console.log('🔵 [UPDATE AGENT CLIENTS] Starting');
    console.log('🔵 [UPDATE AGENT CLIENTS] Client agent:', this.client!.agent);
    console.log('🔵 [UPDATE AGENT CLIENTS] Agent object:', this.agent);
    console.log('🔵 [UPDATE AGENT CLIENTS] Agent clients array:', this.agent?.clients);
    console.log('🔵 [UPDATE AGENT CLIENTS] Client UID:', this.client.uid);
    
    if (
      this.client!.agent !== undefined &&
      this.agent?.clients !== undefined &&
      !this.agent!.clients!.includes(this.client.uid!)
    ) {
      console.log('✅ [UPDATE AGENT CLIENTS] Adding client to agent clients array');
      this.agent?.clients?.push(this.client.uid!);
      console.log('🔵 [UPDATE AGENT CLIENTS] Updated agent clients:', this.agent?.clients);
    } else {
      console.log('⚠️ [UPDATE AGENT CLIENTS] Skipping - conditions not met');
      console.log('  - client.agent undefined?', this.client!.agent === undefined);
      console.log('  - agent.clients undefined?', this.agent?.clients === undefined);
      console.log('  - client already in list?', this.agent?.clients?.includes(this.client.uid!));
    }
  }
  // update the clients array on the previous agent side
  updatePreviousClientAgentInfo() {
    console.log('🔵 [UPDATE PREVIOUS AGENT] Starting');
    console.log('🔵 [UPDATE PREVIOUS AGENT] Previous client agent:', this.previousClientAgent);
    console.log('🔵 [UPDATE PREVIOUS AGENT] Current client agent:', this.client.agent);
    
    if (
      this.previousClientAgent !== 'Choose' &&
      this.previousClientAgent !== undefined &&
      this.previousClientAgent !== this.client.agent
    ) {
      console.log('✅ [UPDATE PREVIOUS AGENT] Conditions met, finding previous agent');
      let employee = this.findAgentWithId(this.previousClientAgent);
      console.log('🔵 [UPDATE PREVIOUS AGENT] Previous employee found:', employee);

      if (employee) {
        console.log('🔵 [UPDATE PREVIOUS AGENT] Previous employee clients before:', employee.clients);
        employee!.clients = employee?.clients?.filter(
          (element) => element !== this.client.uid
        );
        console.log('🔵 [UPDATE PREVIOUS AGENT] Previous employee clients after:', employee.clients);
        console.log('🔵 [UPDATE PREVIOUS AGENT] Updating previous employee info');
        this.data.updateEmployeeInfoForClientAgentAssignment(employee!).then(() => {
          console.log('✅ [UPDATE PREVIOUS AGENT] Previous employee info updated');
        }).catch((err) => {
          console.error('❌ [UPDATE PREVIOUS AGENT] Error updating previous employee:', err);
        });
      } else {
        console.error('❌ [UPDATE PREVIOUS AGENT] Previous employee not found!');
      }
    } else {
      console.log('⚠️ [UPDATE PREVIOUS AGENT] Skipping - conditions not met');
      console.log('  - previousClientAgent is Choose?', this.previousClientAgent === 'Choose');
      console.log('  - previousClientAgent is undefined?', this.previousClientAgent === undefined);
      console.log('  - agents are the same?', this.previousClientAgent === this.client.agent);
    }
  }
}
