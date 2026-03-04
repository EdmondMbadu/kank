import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
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
    if (!this.auth.isAdmin) {
      alert('Action réservée à l’administrateur.');
      this.router.navigate(['/client-portal-card/' + this.id]);
      return;
    }
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
    this.potentialNumbersToSubstract = [];

    const step = Number(this.clientCard.amountToPay);
    const amountPaid = Number(this.clientCard.amountPaid);

    if (
      !Number.isFinite(step) ||
      step <= 0 ||
      !Number.isFinite(amountPaid) ||
      amountPaid <= step
    ) {
      this.amountToSubstract = '';
      return;
    }

    for (let amount = step; amount < amountPaid; amount += step) {
      this.potentialNumbersToSubstract.push(amount);
    }

    this.amountToSubstract = this.potentialNumbersToSubstract.length
      ? this.potentialNumbersToSubstract[0].toString()
      : '';
  }
  async substractFromcard() {
    if (!this.auth.isAdmin) {
      alert('Action réservée à l’administrateur.');
      return;
    }

    if (this.amountToSubstract === '') {
      alert('Remplissez toutes les données');
      return;
    }

    const amount = Number(this.amountToSubstract);
    const step = Number(this.clientCard.amountToPay);
    const amountPaid = Number(this.clientCard.amountPaid);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(step) ||
      step <= 0 ||
      !Number.isFinite(amountPaid)
    ) {
      alert('Montant invalide.');
      return;
    }
    if (amount % step !== 0) {
      alert(`Le montant doit être un multiple de ${step} FC.`);
      return;
    }
    if (amount >= amountPaid) {
      alert('Le retrait partiel doit laisser au moins une tranche sur la carte.');
      return;
    }

    const conf = confirm(
      ` Vous avez effectué ${this.numberOfPaymentToday} dépôt(s) aujourd'hui. Voulez-vous quand même continuer ?`
    );
    if (!conf) {
      return;
    }

    const reverseDeposit = (0 - amount).toString();
    this.clientCard.amountPaid = (amountPaid - amount).toString();
    this.clientCard.numberOfPaymentsMade = (
      Number(this.clientCard.numberOfPaymentsMade) + 1
    ).toString();
    this.clientCard.payments = {
      [this.time.todaysDate()]: reverseDeposit,
    };

    try {
      await this.data.atomicClientCardAndUserUpdate(
        this.clientCard,
        reverseDeposit
      );
      this.router.navigate(['/client-portal-card/' + this.id]);
    } catch (err) {
      alert("Une erreur s'est produite lors d'un paiement, Réessayez");
      return;
    }
  }

  howManyTimesPaidToday() {
    const filteredObj = Object.keys(this.clientCard.payments || {}).filter((key) =>
      key.startsWith(this.today)
    );
    let number = filteredObj.length;
    return number;
  }
}
