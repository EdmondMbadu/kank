import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-payment-activity',
  templateUrl: './payment-activity.component.html',
  styleUrls: ['./payment-activity.component.css'],
})
export class PaymentActivityComponent implements OnInit {
  id: any = '';
  client: Client = new Client();
  public payments: string[] = [];
  public paymentDates: string[] = [];
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private router: Router
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit() {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      this.payments = Object.values(this.client.payments!);
      this.paymentDates = Object.keys(this.client.payments!);
    });
  }
}
