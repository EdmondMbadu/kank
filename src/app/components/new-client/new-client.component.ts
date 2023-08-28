import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-new-client',
  templateUrl: './new-client.component.html',
  styleUrls: ['./new-client.component.css'],
})
export class NewClientComponent {
  constructor(private router: Router) {}

  goToClientInfo() {
    this.router.navigate(['client-info']);
  }
}
