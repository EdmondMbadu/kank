import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-request-client-card',
  templateUrl: './request-client-card.component.html',
  styleUrls: ['./request-client-card.component.css'],
})
export class RequestClientCardComponent {
  id: any = '';
  today = this.time.todaysDateMonthDayYear();
  paymentOtherAmount: boolean = false;
  savingsOtherAmount: boolean = false;
  amountToReturnToClient: string = '';
  numberOfPaymentToday = 0;
  requestAmount: string = '';
  requestDate: string = '';
  clientCard: Card = new Card();
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

  retrieveClientCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.clientCard = data[Number(this.id)];
      this.amountToReturnToClient = (
        Number(this.clientCard.amountPaid) - Number(this.clientCard.amountToPay)
      ).toString();

      this.numberOfPaymentToday = this.howManyTimesPaidToday();
    });
  }

  async returnCLientCardMoney() {
    let checkDate = this.time.validateDateWithInOneWeekNotPastOrToday(
      this.requestDate
    );
    if (this.amountToReturnToClient === '') {
      alert('Remplissez toutes les données');
      return;
    } else if (!checkDate) {
      alert(`Assurez-vous que la date de Donner L'argent au client\n
        - Est Dans L'intervalle D'Une Semaine\n
        - N'est Pas Aujourdhui ou au Passé
        `);
      return;
    } else {
      let conf = confirm(
        ` Vous allez demander le remboursement de ${this.amountToReturnToClient} FC pour ${this.clientCard.firstName} ${this.clientCard.middleName} ${this.clientCard.lastName}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.clientCard.amountPaid = '0';

      this.clientCard.withdrawal = {
        [this.time.todaysDate()]: this.amountToReturnToClient,
      };
    }
    this.clientCard.clientCardStatus = 'ended';

    try {
      this.requestDate = this.time.convertDateToMonthDayYear(this.requestDate);
      const amountToReturn = this.amountToReturnToClient;
      this.requestAmount = this.amountToReturnToClient;
      this.clientCard.requestAmount = this.amountToReturnToClient;
      this.clientCard.requestDate = this.requestDate;

      const clientCardPayment = await this.data.clientCardRequestReturnMoney(
        this.clientCard
      );
      const updateUser =
        await this.data.updateUserInfoForClientCardRequestReturnMoney(
          amountToReturn
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
