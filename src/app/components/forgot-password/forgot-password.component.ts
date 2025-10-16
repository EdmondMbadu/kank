import { Component } from '@angular/core';
import { PublicAuthService } from 'src/app/services/public-auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
})
export class ForgotPasswordComponent {
  email: string = '';
  constructor(private auth: PublicAuthService) {}
  restorePassword() {
    this.auth.forgotPassword(this.email);
  }
}
