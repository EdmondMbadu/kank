import { OnInit } from '@angular/core';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { async } from 'rxjs';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-card-cycle',
  templateUrl: './card-cycle.component.html',
  styleUrls: ['./card-cycle.component.css'],
})
export class CardCycleComponent implements OnInit {
  clientCard = new Card();

  id: any = '';
  amountToPay: string = '';
  amountToGiveClient: string = '';
  status: string = 'En Cours';
  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private time: TimeService,
    private data: DataService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClientCard();
  }

  retrieveClientCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.clientCard = data[Number(this.id)];
    });
  }

  addNewCardClient() {
    let inputValid = this.data.numbersValid(this.amountToPay);
    if (
      this.clientCard.firstName === '' ||
      this.clientCard.lastName === '' ||
      this.clientCard.middleName === '' ||
      this.clientCard.profession === '' ||
      this.clientCard.businessAddress === '' ||
      this.clientCard.homeAddress === '' ||
      this.clientCard.phoneNumber === '' ||
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
        `${this.clientCard.firstName} ${this.clientCard.middleName} ${this.clientCard.lastName} va commencez a verser un montant de ${this.amountToPay} FC minimum pour sa carte. Voulez-vous quand même continuer ?`
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
      const addCardResult = await this.auth.startNewCardCycle(this.clientCard);
      // Proceed with the next operation only after the previous one has completed.
      const updateInfoResult =
        await this.data.updateUserInfoForNewCardCycleClient(this.clientCard);
      console.log('Informations utilisateur cartes mises à jour avec succès');
      this.router.navigate(['/client-portal-card/' + this.id]);
    } catch (err) {
      alert(
        "Quelque chose s'est mal passé. Impossible de commencer un nouveau cycle de carte. Essayez encore"
      );
      console.log(err);
      return;
    }
  }

  setNewCardValues() {
    this.clientCard.amountToPay = this.amountToPay;
    this.clientCard.cardCycle = (
      Number(this.clientCard.cardCycle) + 1
    ).toString();
    this.clientCard.amountPaidToday = this.amountToPay;
    this.clientCard.payments = {
      [this.time.todaysDate()]: this.amountToPay,
    };
  }
}
