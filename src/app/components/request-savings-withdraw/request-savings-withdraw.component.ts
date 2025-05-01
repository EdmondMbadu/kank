import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-request-savings-withdraw',
  templateUrl: './request-savings-withdraw.component.html',
  styleUrls: ['./request-savings-withdraw.component.css'],
})
export class RequestSavingsWithdrawComponent implements OnInit {
  id: any = '';
  paymentOtherAmount: boolean = false;
  savingsOtherAmount: boolean = false;

  requestAmount: string = '';
  requestDate: string = '';
  client: Client = new Client();
  constructor(
    private router: Router,
    public auth: AuthService,
    private data: DataService,
    private activatedRoute: ActivatedRoute,
    private time: TimeService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
    });
  }
  displaySavingsOtherAmount() {
    if (this.requestAmount === 'Autre Montant') {
      this.savingsOtherAmount = true;
      this.requestAmount = '';
    } else {
      this.savingsOtherAmount = false;
    }
  }
  requestSavingsWithdrawal() {
    let checkDate = this.time.validateDateWithInOneWeekNotPastOrTodayCard(
      this.requestDate
    );

    if (this.requestAmount === '' || this.requestDate === '') {
      alert('Remplissez toutes les données');
      return;
    } else if (Number.isNaN(Number(this.requestAmount))) {
      alert('Entrée incorrecte. Entrez un numéro');
      return;
    } else if (Number(this.requestAmount) > Number(this.client.savings)) {
      alert(
        "Vous n'avez pas suffisament d'argent pour effectuer cette transaction!"
      );
      return;
    } else if (Number(this.requestAmount) <= 0) {
      alert('Entrez un nombre valid positifs');
      return;
    } else if (!checkDate) {
      alert(`Assurez-vous que la date de remettre L'argent au client\n
        - Est Dans L'intervalle D'Une Semaine\n
        - N'est Pas Aujourdhui ou au Passé
        `);
      return;
    }
    let conf = confirm(
      ` Vous allez demander le retrait de ${this.requestAmount} FC dans votre compte D'epargnes. Voulez-vous quand même continuer ?`
    );
    if (!conf) {
      return;
    } else {
      // this.client.savings = (
      //   Number(this.client.savings) - Number(this.savingsWithdrawn)
      // ).toString();
      // this.client.savingsPayments = {
      //   [this.time.todaysDate()]: `-${this.savingsWithdrawn}`,
      // };
      this.requestDate = this.time.convertDateToMonthDayYear(this.requestDate);
      this.client.requestDate = this.requestDate;
      this.client.requestAmount = this.requestAmount;
      this.client.dateOfRequest = this.time.todaysDate();

      this.data.clientRequestSavingsWithdrawal(this.client, this.requestAmount);
      this.router.navigate(['/client-portal/' + this.id]);
    }
  }
}
