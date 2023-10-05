import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
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
  client = new Client();
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
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
    });
  }

  updateClientInfo() {
    if (
      this.client.firstName === '' ||
      this.client.lastName === '' ||
      this.client.phoneNumber === '' ||
      this.client.businessAddress === '' ||
      this.client.businessAddress === '' ||
      this.client.profession === '' ||
      this.client.paymentDay === ''
    ) {
      alert('Fill all fields');
      return;
    } else {
      this.data.updateClientInfo(this.client);
      this.router.navigate(['/client-portal/' + this.id]);
    }
  }
}
