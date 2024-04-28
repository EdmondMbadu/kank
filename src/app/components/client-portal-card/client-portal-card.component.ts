import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-client-portal-card',
  templateUrl: './client-portal-card.component.html',
  styleUrls: ['./client-portal-card.component.css'],
})
export class ClientPortalCardComponent {
  clientCard = new Card();

  id: any = '';
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
      this.status = !!this.clientCard.clientCardStatus
        ? 'Terminé'
        : this.status;
      this.computeAmountToGiveClient();
    });
  }

  computeAmountToGiveClient() {
    this.amountToGiveClient =
      this.clientCard.amountPaid === '0'
        ? '0'
        : (
            Number(this.clientCard.amountPaid) -
            Number(this.clientCard.amountToPay)
          ).toString();
  }

  payClient() {
    if (
      Number(this.clientCard.amountPaid) <= Number(this.clientCard.amountToPay)
    ) {
      alert(
        `Vous devez versez au moins 2 fois le montant de ${this.clientCard.amountToPay} FC pour être payé. Vous n'avez versez qu'une seule fois.`
      );
      return;
    } else {
      this.router.navigate(['/return-client-card/' + this.id]);
    }
  }
  addMoney() {
    if (this.status !== 'En Cours') {
      alert(`Ce cycle est terminé, commencez un nouveau cycle.`);
      return;
    } else {
      this.router.navigate(['/payment-card/' + this.id]);
    }
  }
  startNewCardCycle() {
    if (this.clientCard.clientCardStatus !== 'ended') {
      alert("Finissez d'abord ce cycle avant d'entamer en nouveau Cycle");
      return;
    } else {
      this.router.navigate(['/card-cycle/' + this.id]);
    }
  }

  removeFromCard() {
    if (this.status !== 'En Cours') {
      alert(`Ce cycle est terminé, commencez un nouveau cycle.`);
      return;
    } else if (this.clientCard.amountPaid === this.clientCard.amountToPay) {
      alert(
        `Vous devez payer plus que le montant initial pour soustraire un montant`
      );
      return;
    } else {
      this.router.navigate(['/remove-card/' + this.id]);
    }
  }
}
