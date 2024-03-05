import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-return-client-card',
  templateUrl: './return-client-card.component.html',
  styleUrls: ['./return-client-card.component.css'],
})
export class ReturnClientCardComponent {
  id: any = '';
  today = this.time.todaysDateMonthDayYear();
  paymentOtherAmount: boolean = false;
  savingsOtherAmount: boolean = false;
  amountToReturnToClient: string = '';
  numberOfPaymentToday = 0;
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
    if (this.amountToReturnToClient === '') {
      alert('Remplissez toutes les données');
      return;
    } else {
      let conf = confirm(
        ` Vous allez rembourser ${this.amountToReturnToClient} FC à ${this.clientCard.firstName} ${this.clientCard.middleName} ${this.clientCard.lastName}. Voulez-vous quand même continuer ?`
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
      const amountToReturn = this.amountToReturnToClient;

      const clientCardPayment = await this.data.clientCardReturnMoney(
        this.clientCard
      );
      const updateUser = await this.data.updateUserInfoForClientCardReturnMoney(
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
