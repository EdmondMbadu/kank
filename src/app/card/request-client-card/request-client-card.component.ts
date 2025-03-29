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
  totalPaidToday: number = 0;
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
      console.log('this.clientCard', this.clientCard);
      this.totalPaidToday = this.sumPaymentsMadeToday(
        this.clientCard.payments!
      );

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
    const amountToReturnNum = Number(this.amountToReturnToClient);
    if (this.amountToReturnToClient === '') {
      alert('Remplissez toutes les données');
      return;
    }

    // Check if total paid today is >= 40% of the amount to return
    // this condtion is because of PUMBU. will be monitoring this.
    else if (this.totalPaidToday >= 0.4 * amountToReturnNum) {
      alert(
        'Vous avez déjà donné beaucoup d’argent aujourd’hui. ' +
          'Vous devriez attendre demain pour demander votre argent.'
      );
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
      this.clientCard.dateOfRequest = this.time.todaysDate();
      const clientCardPayment = await this.data.clientCardRequestReturnMoney(
        this.clientCard
      );
      const updateUser =
        await this.data.updateUserInfoForClientCardRequestReturnMoney(
          amountToReturn,
          this.clientCard
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
  sumPaymentsMadeToday(payments: any) {
    // Get today's date in MM-DD-YYYY
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(1, '0');
    const dd = String(today.getDate()).padStart(1, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${mm}-${dd}-${yyyy}`;

    let sum = 0;
    // Iterate over each key in the payments object
    for (const [key, value] of Object.entries(payments)) {
      // If the key starts with today's date string, add to the sum
      if (key.startsWith(todayStr)) {
        sum += Number(value);
      }
    }
    return sum;
  }
}
