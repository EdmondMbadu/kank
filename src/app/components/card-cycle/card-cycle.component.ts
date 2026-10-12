import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, Subject, take, takeUntil } from 'rxjs';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { isTenDigitPhone, tenDigitPhoneValidationMessage } from 'src/app/utils/ten-digit-phone.util';
import { CardPhoneValidationError } from 'src/app/utils/card-phone-identity.util';

@Component({
  selector: 'app-card-cycle',
  templateUrl: './card-cycle.component.html',
  styleUrls: ['./card-cycle.component.css'],
})
export class CardCycleComponent implements OnInit, OnDestroy {
  clientCard = new Card();
  phoneInteracted = false;
  phoneIdentityError = '';
  isSubmitting = false;
  private readonly destroyed$ = new Subject<void>();
  private destroyed = false;
  @ViewChild('phoneInput') phoneInput?: ElementRef<HTMLInputElement>;

  get isPhoneNumberValid(): boolean {
    return isTenDigitPhone(this.clientCard?.phoneNumber);
  }

  get phoneValidationMessage(): string {
    return tenDigitPhoneValidationMessage(this.clientCard?.phoneNumber, this.phoneInteracted) || this.phoneIdentityError;
  }

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
    this.auth.getAllClientsCard().pipe(
      filter((data: any) => Array.isArray(data) && !!data[Number(this.id)]),
      take(1),
      takeUntil(this.destroyed$)
    ).subscribe((data: any) => {
      this.clientCard = { ...data[Number(this.id)] };
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  addNewCardClient() {
    if (this.isSubmitting) return;
    this.phoneIdentityError = '';
    this.phoneInteracted = true;
    if (!this.isPhoneNumberValid) {
      this.phoneInput?.nativeElement.focus();
      return;
    }
    let inputValid = this.data.numbersValid(this.amountToPay);
    if (
      this.clientCard.firstName === '' ||
      this.clientCard.lastName === '' ||
      this.clientCard.middleName === '' ||
      this.clientCard.profession === '' ||
      this.clientCard.businessAddress === '' ||
      this.clientCard.homeAddress === '' ||
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
      this.addClientAndNavigate(this.setNewCardValues());
    }
  }

  async addClientAndNavigate(card: Card) {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    try {
      await this.auth.validateClientCardPhone(card, card.uid);
      if (this.destroyed) return;
      const conf = confirm(
        `${card.firstName} ${card.middleName} ${card.lastName} va commencez a verser un montant de ${card.amountToPay} FC minimum pour sa carte. Voulez-vous quand même continuer ?`
      );
      if (!conf) return;
      const addCardResult = await this.auth.startNewCardCycle(card);
      // Proceed with the next operation only after the previous one has completed.
      const updateInfoResult =
        await this.data.updateUserInfoForNewCardCycleClient(card);
      this.clientCard = card;
      console.log('Informations utilisateur cartes mises à jour avec succès');
      if (this.destroyed) return;
      this.router.navigate(['/client-portal-card/' + this.id]);
    } catch (err) {
      if (this.destroyed) return;
      if (err instanceof CardPhoneValidationError) {
        this.phoneIdentityError = err.message;
        this.phoneInput?.nativeElement.focus();
        return;
      }
      alert(
        "Quelque chose s'est mal passé. Impossible de commencer un nouveau cycle de carte. Essayez encore"
      );
      console.log(err);
      return;
    } finally {
      this.isSubmitting = false;
    }
  }

  setNewCardValues(): Card {
    return {
      ...this.clientCard,
      amountToPay: this.amountToPay,
      cardCycle: (Number(this.clientCard.cardCycle) + 1).toString(),
      amountPaidToday: this.amountToPay,
      payments: { [this.time.todaysDate()]: this.amountToPay },
    };
  }
}
