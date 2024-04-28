import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-remove-card',
  templateUrl: './remove-card.component.html',
  styleUrls: ['./remove-card.component.css'],
})
export class RemoveCardComponent {
  id: any = '';
  today = this.time.todaysDateMonthDayYear();
  paymentOtherAmount: boolean = false;
  savingsOtherAmount: boolean = false;

  numberOfPaymentToday = 0;
  clientCard: Card = new Card();
  potentialNumbersToSubstract: number[] = [];
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private time: TimeService,
    private compute: ComputationService,
    private performance: PerformanceService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClientCard();
  }
  amountToSubstract: string = '';

  retrieveClientCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.clientCard = data[Number(this.id)];
      this.generatePotentialNumbersToSubstract();
      this.numberOfPaymentToday = this.howManyTimesPaidToday();
    });
  }
  generatePotentialNumbersToSubstract() {
    for (
      let a = Number(this.clientCard.amountToPay), i = 2;
      a < Number(this.clientCard.amountPaid);
      i++
    ) {
      this.potentialNumbersToSubstract.push(a);
      a *= i;
    }
    console.log('numbers ', this.potentialNumbersToSubstract);
  }
  async substractFromcard() {
    if (this.amountToSubstract === '') {
      alert('Remplissez toutes les données');
      return;
    } else {
      let conf = confirm(
        ` Vous avez effectué ${this.numberOfPaymentToday} dépôt(s) aujourd'hui. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      // make the number negative
      this.amountToSubstract = (0 - Number(this.amountToSubstract)).toString();
      this.clientCard.amountPaid = (
        Number(this.clientCard.amountPaid) + Number(this.amountToSubstract)
      ).toString();
      this.clientCard.numberOfPaymentsMade = (
        Number(this.clientCard.numberOfPaymentsMade) + 1
      ).toString();

      this.clientCard.payments = {
        [this.time.todaysDate()]: this.amountToSubstract,
      };
    }

    try {
      const clientCardPayment = await this.data.clientCardPayment(
        this.clientCard
      );
      const updateUser = await this.data.updateUserInfoForClientCardPayment(
        this.amountToSubstract
      );
      this.router.navigate(['/client-portal-card/' + this.id]);
    } catch (err) {
      alert("Une erreur s'est produite lors d'un paiement, Réessayez");
      return;
    }
  }

  howManyTimesPaidToday() {
    const filteredObj = Object.keys(this.clientCard.payments!).filter((key) =>
      key.startsWith(this.today)
    );
    let number = filteredObj.length;
    return number;
  }
}
