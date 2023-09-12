import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css'],
})
export class LandingPageComponent {
  email: string = '';
  password: string = '';
  ngOnInit() {}
  constructor(private auth: AuthService) {}

  SignOn() {
    if (this.email === '' || this.password === '') {
      alert('FIll all fields');
      return;
    }
    this.auth.SignOn(this.email, this.password);
  }
}
