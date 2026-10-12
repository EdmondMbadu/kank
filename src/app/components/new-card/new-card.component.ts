import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { isTenDigitPhone, tenDigitPhoneValidationMessage } from 'src/app/utils/ten-digit-phone.util';
import { CardPhoneValidationError } from 'src/app/utils/card-phone-identity.util';

@Component({
  selector: 'app-new-card',
  templateUrl: './new-card.component.html',
  styleUrls: ['./new-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewCardComponent implements OnInit, OnDestroy {
  constructor(
    private router: Router,
    public auth: AuthService,
    public data: DataService,
    private time: TimeService,
    private performance: PerformanceService,
    private cdr: ChangeDetectorRef
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
  phoneInteracted = false;
  phoneIdentityError = '';
  isSubmitting = false;
  private destroyed = false;
  @ViewChild('phoneInput') phoneInput?: ElementRef<HTMLInputElement>;
  amountPaidToday: string = '';

  amountToPay: string = '';

  get isPhoneNumberValid(): boolean {
    return isTenDigitPhone(this.phoneNumber);
  }

  get phoneValidationMessage(): string {
    return tenDigitPhoneValidationMessage(this.phoneNumber, this.phoneInteracted) || this.phoneIdentityError;
  }

  get clientDisplayName(): string {
    const parts = [this.firstName, this.middleName, this.lastName]
      .map((value) => value.trim())
      .filter(Boolean);

    return parts.length ? parts.join(' ') : 'Client a creer';
  }

  get clientInitials(): string {
    const parts = [this.firstName, this.middleName, this.lastName]
      .map((value) => value.trim())
      .filter(Boolean);

    if (!parts.length) {
      return 'NC';
    }

    return parts
      .slice(0, 2)
      .map((value) => value.charAt(0))
      .join('')
      .toUpperCase();
  }

  get amountPreview(): string {
    const amount = this.amountToPay.trim();
    return amount ? `${amount} FC` : 'Non renseigne';
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroyed = true;
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
      this.firstName === '' ||
      this.lastName === '' ||
      this.middleName === '' ||
      this.profession === '' ||
      this.businessAddress === '' ||
      this.homeAddress === '' ||
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
      this.setNewCardValues();
      this.addClientAndNavigate();
    }
  }
  async addClientAndNavigate() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    const card = { ...this.card };
    try {
      await this.auth.validateClientCardPhone(card);
      if (this.destroyed) return;
      const conf = confirm(
        `${card.firstName} ${card.middleName} ${card.lastName} va commencez a verser un montant de ${card.amountToPay} FC minimum pour sa carte. Voulez-vous quand même continuer ?`
      );
      if (!conf) return;
      card.payments = {
        [this.time.todaysDate()]: card.amountToPay!,
      };
      this.card = card;
      const addCardResult = await this.auth.addNewClientCard(card);
      // Proceed with the next operation only after the previous one has completed.
      const updateInfoResult = await this.data.updateUserInfoForNewCardClient(
        card
      );
      console.log('Informations utilisateur cartes mises à jour avec succès');
      if (this.destroyed) return;
      this.resetFields();
      this.router.navigate(['client-info-card/current']);
    } catch (err) {
      if (this.destroyed) return;
      if (err instanceof CardPhoneValidationError) {
        this.phoneIdentityError = err.message;
        this.phoneInput?.nativeElement.focus();
        return;
      }
      alert(
        "Quelque chose s'est mal passé. Impossible d'ajouter un nouveau client de carte. Essayez encore"
      );
      console.log(err);
    } finally {
      this.isSubmitting = false;
      if (!this.destroyed) this.cdr.markForCheck();
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
    this.phoneInteracted = false;
    this.phoneIdentityError = '';
    this.businessAddress = '';
    this.homeAddress = '';
    this.amountToPay = '';
    this.amountPaidToday = '';
  }
}
