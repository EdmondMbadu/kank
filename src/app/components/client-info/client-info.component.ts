import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';

@Component({
  selector: 'app-client-info',
  templateUrl: './client-info.component.html',
  styleUrls: ['./client-info.component.css'],
})
export class ClientInfoComponent {
  constructor(private router: Router) {}
  public clientArray: Client[] = [
    {
      id: 1,
      name: 'Masevo Konde',
      dateJoined: '11/03/2021',
      creditScore: '330',
      phone: '123-323-2323',
    },
    {
      id: 2,
      name: 'Vuandu Albertine',
      dateJoined: '11/03/2021',
      creditScore: '800',
      phone: '123-323-2323',
    },
    {
      id: 3,
      name: 'Mukulu Josue',
      dateJoined: '11/03/2021',
      creditScore: '100',
      phone: '123-323-2323',
    },
    {
      id: 3,
      name: 'Mabela Kikona',
      dateJoined: '11/03/2021',
      creditScore: '802',
      phone: '123-323-2323',
    },
  ];

  goToClientPortal() {
    this.router.navigate(['']);
  }
  goToNewClient() {
    this.router.navigate(['new-client']);
  }
}
