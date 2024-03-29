import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent {
  constructor(private router: Router, private auth: AuthService) {}
  hide: boolean = true;
  @Input() email = '';
  @Input() path = '';
  creditDropDown: boolean = false;
  cardDropDown: boolean = false;
  @Input() firstName = '';
  @Input() currentHome: boolean = false;
  @Input() currentClientInfo: boolean = false;
  @Input() currentNewClient: boolean = false;
  @Input() currentNewClientCard: boolean = false;
  @Input() currentEmployeePage: boolean = false;

  @Input() current = 'py-1 border-1 border-b-4';

  toggleMenu() {
    if (this.hide === true) {
      this.hide = false;
    } else {
      this.hide = true;
    }
  }

  toggleCreditDropDown() {
    this.creditDropDown = !this.creditDropDown;
  }
  toggleCardDropDown() {
    this.cardDropDown = !this.cardDropDown;
  }
  logOut() {
    this.auth.logout();
  }
}
