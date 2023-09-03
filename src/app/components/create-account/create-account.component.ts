import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-create-account',
  templateUrl: './create-account.component.html',
  styleUrls: ['./create-account.component.css'],
})
export class CreateAccountComponent {
  email: string = '';
  password: string = '';
  rePassword: string = '';
  user: User = {
    uid: '',
    email: '',
  };
  constructor(
    private auth: AuthService,
    private data: DataService,
    private router: Router
  ) {}
  ngOnInit(): void {}
  createAccount() {
    if (this.email === '' || this.password === '' || this.rePassword === '') {
      alert('Fill all the fields');
      return;
    } else if (this.password !== this.rePassword) {
      alert(' Both Passwords need to match');
      return;
    }

    this.user.email = this.email;
    this.auth.register(this.email, this.password);
    this.resetFields();
  }

  resetFields() {
    this.email = '';
    this.password = '';
    this.rePassword = '';
  }
}
