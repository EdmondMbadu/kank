import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-client-info',
  templateUrl: './client-info.component.html',
  styleUrls: ['./client-info.component.css'],
})
export class ClientInfoComponent implements OnInit {
  clients?: Client[];
  constructor(private router: Router, public auth: AuthService) {
    this.retrieveClients();
  }
  debts: string[] = [];
  ngOnInit(): void {
    // this.retrieveClients();
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.computeDebts();
      // console.log('clienf info ', data);
    });
  }
  computeDebts() {
    for (let s of this.clients!) {
      this.debts.push((Number(s.loanAmount) - Number(s.amountPaid)).toString());
    }
  }
}
