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
  constructor(private router: Router, public auth: AuthService) {}
  ngOnInit(): void {
    this.retrieveClients();
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      console.log('clienf info ', data);
    });
  }
}
