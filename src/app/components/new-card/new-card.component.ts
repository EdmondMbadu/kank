import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-new-card',
  templateUrl: './new-card.component.html',
  styleUrls: ['./new-card.component.css'],
})
export class NewCardComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    public data: DataService,
    private time: TimeService,
    private performance: PerformanceService
  ) {}
  amountToPayDisplay: boolean = false;
  debtCycleDisplay: boolean = false;
  card = new Card();
  firstName: string = '';
  lastName: string = '';
  middleName: string = '';
  profession: string = '';
  bussinessCapital: string = '';
  homeAddress: string = '';
  businessAddress: string = '';
  phoneNumber: string = '';
  amountPaidToday: string = '';

  amountToPay: string = '';

  ngOnInit(): void {}

  addNewCardClient() {
    let inputValid = this.data.numbersValid(this.amountToPay);
    if (
      this.firstName === '' ||
      this.lastName === '' ||
      this.middleName === '' ||
      this.profession === '' ||
      this.businessAddress === '' ||
      this.homeAddress === '' ||
      this.phoneNumber === '' ||
      this.amountToPay === ''
    ) {
      alert('Completer tous les données');
      return;
    } else if (!inputValid) {
      alert(
        'Assurez-vous que le montant a payer est un nombre et est supérieurs  à 0'
      );
      return;
    } else {
      let conf = confirm(
        `${this.firstName} ${this.middleName} ${this.lastName} va commencez a verser un montant de ${this.amountToPay} FC minimum pour sa carte. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.setNewCardValues();
      this.addClientAndNavigate();
    }
  }
  async addClientAndNavigate() {
    try {
      this.card.payments = {
        [this.time.todaysDate()]: this.amountToPay,
      };
      const addCardResult = await this.auth.addNewClientCard(this.card);
      // Proceed with the next operation only after the previous one has completed.
      const updateInfoResult = await this.data.updateUserInfoForNewCardClient(
        this.card
      );
      console.log('Informations utilisateur cartes mises à jour avec succès');
      this.resetFields();
      this.router.navigate(['client-info-card/current']);
    } catch (err) {
      alert(
        "Quelque chose s'est mal passé. Impossible d'ajouter un nouveau client de carte. Essayez encore"
      );
      console.log(err);
    }
  }

  setNewCardValues() {
    this.card.firstName = this.firstName;
    this.card.middleName = this.middleName;
    this.card.lastName = this.lastName;
    this.card.phoneNumber = this.phoneNumber;
    this.card.profession = this.profession;
    this.card.businessAddress = this.businessAddress;
    this.card.homeAddress = this.homeAddress;
    this.card.amountToPay = this.amountToPay;
    this.card.amountPaidToday = this.amountToPay;
  }
  resetFields() {
    this.firstName = '';
    this.middleName = '';
    this.lastName = '';
    this.phoneNumber = '';
    this.businessAddress = '';
    this.homeAddress = '';
    this.amountToPay = '';
    this.amountPaidToday = '';
  }
}
