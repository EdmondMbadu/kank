import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-new-client',
  templateUrl: './new-client.component.html',
  styleUrls: ['./new-client.component.css'],
})
export class NewClientComponent implements OnInit {
  constructor(private router: Router, public auth: AuthService) {}
  ngOnInit() {}
  client = new Client();
  firstName: string = '';
  lastName: string = '';
  profession: string = '';
  bussinessCapital: string = '';
  homeAddress: string = '';
  businessAddress: string = '';
  phoneNumber: string = '';
  applicactionFee: string = '';
  memberShipFee: string = '';
  savings: string = '';
  loanAmount: string = '';

  addNewClient() {
    console.log('firstnmae, loan amount', this.firstName, this.loanAmount);
    if (
      this.firstName === '' ||
      this.lastName === '' ||
      this.profession === '' ||
      this.businessAddress === '' ||
      this.bussinessCapital === '' ||
      this.homeAddress === '' ||
      this.phoneNumber === '' ||
      this.applicactionFee === '' ||
      this.memberShipFee === '' ||
      this.savings === '' ||
      this.loanAmount === ''
    ) {
      alert('All fields are required');
      return;
    } else {
      this.setNewClientValues();
      this.auth.addNewClient(this.client).then(
        (res: any) => {
          this.router.navigate(['client-info']);
        },
        (err: any) => {
          alert('Something went wrong. Unable to add New client');
        }
      );
      this.auth.updateUserInfo(this.client).then(
        (res: any) => {
          console.log('Updated user info successfully');
        },
        (err: any) => {
          alert('Something went wrong. Unable to add New client');
        }
      );

      this.resetFields();
      return;
    }
  }

  resetFields() {
    this.client = new Client();
    this.firstName = '';
    this.lastName = '';
    this.profession = '';
    this.bussinessCapital = '';
    this.homeAddress = '';
    this.businessAddress = '';
    this.phoneNumber = '';
    this.applicactionFee = '';
    this.memberShipFee = '';
    this.savings = '';
    this.loanAmount = '';
  }
  setNewClientValues() {
    this.client.firstName = this.firstName;
    this.client.lastName = this.lastName;
    this.client.profession = this.profession;
    this.client.businessCapital = this.bussinessCapital;
    this.client.businessAddress = this.businessAddress;
    this.client.phoneNumber = this.phoneNumber;
    this.client.homeAddress = this.homeAddress;
    this.client.applicationFee = this.applicactionFee;
    this.client.membershipFee = this.memberShipFee;
    this.client.savings = this.savings;
    this.client.loanAmount = this.loanAmount;
  }
}
