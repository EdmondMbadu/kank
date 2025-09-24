import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

/* ✨  NEW imports */
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  of,
  switchMap,
} from 'rxjs';
import { AngularFirestore } from '@angular/fire/compat/firestore';

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
  dateJoined: string = '';

  modalOpen = false; // controls the overlay
  creditClients: Client[] = []; // list with debt > 0
  filtered: Client[] = [];
  selected?: Client;

  search = new FormControl('');
  amount = new FormControl('', [Validators.required, Validators.min(1)]);

  editForm!: FormGroup;
  saving = false;
  saveMsg = '';
  saveOk = false;

  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private time: TimeService,
    private data: DataService,
    private fb: FormBuilder,
    private afs: AngularFirestore
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClientCard();

    this.loadCreditClients(); // 👈 new
    this.setupLiveSearch();
  }

  /* ---------- open / close ---------- */
  openTransferModal() {
    if (this.amountToGiveClient === '0') {
      alert(
        "Vous n'avez pas d'argent pour faire le transfer. Ajouter l'argent à la carte."
      );
      return;
    }
    this.modalOpen = true;
    this.amount.reset();
    this.search.setValue('');
    this.filtered = [...this.creditClients];
    this.selected = undefined;
  }

  closeModal() {
    this.modalOpen = false;
  }
  // retrieveClientCard(): void {
  //   this.auth.getAllClientsCard().subscribe((data: any) => {
  //     this.clientCard = data[Number(this.id)];
  //     this.dateJoined = this.time.formatDateForDRC(this.clientCard.dateJoined);

  //     this.status = !!this.clientCard.clientCardStatus
  //       ? 'Terminé'
  //       : this.status;
  //     this.computeAmountToGiveClient();
  //   });
  // }

  retrieveClientCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.clientCard = data[Number(this.id)];
      this.dateJoined = this.time.formatDateForDRC(this.clientCard.dateJoined);
      this.status = !!this.clientCard.clientCardStatus
        ? 'Terminé'
        : this.status;
      this.computeAmountToGiveClient();

      // (Re)build or patch the form with fresh data
      if (!this.editForm) this.initEditForm();
      else this.editForm.patchValue(this.toFormValues(this.clientCard));
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
  requestMoney() {
    if (
      Number(this.clientCard.amountPaid) <= Number(this.clientCard.amountToPay)
    ) {
      alert(
        `Vous devez versez au moins 2 fois le montant de ${this.clientCard.amountToPay} FC pour être payé. Vous n'avez versez qu'une seule fois.`
      );
      return;
    } else {
      this.router.navigate(['/request-client-card/' + this.id]);
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

  /* --- NEW helpers ------------------------------------------------------- */
  private async loadCreditClients() {
    this.auth.getAllClients().subscribe((data: any) => {
      this.creditClients = this.data.findClientsWithDebts(data);
      this.filtered = [...this.creditClients];
    });
  }

  private setupLiveSearch() {
    this.search.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((v: any) => this.filterList(v))
      )
      .subscribe((res) => (this.filtered = res));
  }
  private filterList(q: string) {
    if (!q) return of(this.creditClients);
    const s = q.toLowerCase();
    return of(
      this.creditClients.filter(
        (c) =>
          c.firstName?.toLowerCase().includes(s) ||
          c.lastName?.toLowerCase().includes(s) ||
          c.middleName?.toLowerCase().includes(s) ||
          c.phoneNumber?.includes(s)
      )
    );
  }

  namesOverlap(card: Card, credit: Client): boolean {
    const cardNames = [card.firstName, card.middleName, card.lastName]
      .filter(Boolean)
      .map((name) => name!.toLowerCase());

    const creditNames = [credit.firstName, credit.middleName, credit.lastName]
      .filter(Boolean)
      .map((name) => name!.toLowerCase());

    return cardNames.some((name) => creditNames.includes(name));
  }

  /* --------- the actual transfer action -------- */
  async transferFromCard() {
    if (!this.selected) {
      alert('Sélectionnez un client crédit.');
      return;
    }
    if (this.amount.invalid) {
      alert('Montant invalide.');
      return;
    }

    const amt = +this.amount.value!;
    const avail = +this.clientCard.amountPaid!;
    const step = +this.clientCard.amountToPay!; // la tranche de la carte

    /* --- new rule: only multiples of amountToPay --- */
    if (step > 0 && amt % step !== 0) {
      return alert(
        `Le montant doit être un multiple de ${step} FC (ex. ${step}, ${
          step * 2
        }, ${step * 3}…)`
      );
    }

    if (amt > avail) {
      return alert(`Seulement ${avail} FC disponibles sur la carte.`);
    }
    if (!this.namesOverlap(this.clientCard, this.selected)) {
      return alert('Aucun nom ne correspond, vérifiez votre sélection.');
    }

    const ok = confirm(
      `Transférer ${amt} FC de la carte de ${this.clientCard.firstName} ` +
        `${this.clientCard.lastName} vers la dette de ` +
        `${this.selected.firstName} ${this.selected.lastName} ?`
    );
    if (!ok) return;

    try {
      await this.data.transferCardToCredit(this.clientCard, this.selected, amt);
      alert('Transfert effectué ✅');
      this.closeModal();
      this.retrieveClientCard(); // refresh card info
    } catch (error) {
      console.error('Erreur transfert:', error);
      alert('Une erreur est survenue lors du transfert.');
    }
  }

  // Build the form once we have clientCard loaded
  private initEditForm() {
    this.editForm = this.fb.group({
      firstName: [this.clientCard.firstName ?? '', [Validators.required]],
      lastName: [this.clientCard.lastName ?? ''],
      middleName: [this.clientCard.middleName ?? ''],

      phoneNumber: [
        this.clientCard.phoneNumber ?? '',
        [Validators.minLength(7)],
      ],

      businessAddress: [this.clientCard.businessAddress ?? ''],
      homeAddress: [this.clientCard.homeAddress ?? ''],
      profession: [this.clientCard.profession ?? ''],

      amountPaid: [
        Number(this.clientCard.amountPaid ?? 0),
        [Validators.min(0)],
      ],
      amountToPay: [
        Number(this.clientCard.amountToPay ?? 0),
        [Validators.min(0)],
      ],
      cardCycle: [Number(this.clientCard.cardCycle ?? 0), [Validators.min(0)]],
      numberOfPaymentsMade: [
        Number(this.clientCard.numberOfPaymentsMade ?? 0),
        [Validators.min(0)],
      ],

      clientCardStatus: [this.clientCard.clientCardStatus ?? ''],
      dateJoined: [this.clientCard.dateJoined ?? ''],
    });
  }

  /** Map model -> form raw values (used by reset button) */
  toFormValues(c: Card) {
    return {
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      middleName: c.middleName ?? '',
      phoneNumber: c.phoneNumber ?? '',
      businessAddress: c.businessAddress ?? '',
      homeAddress: c.homeAddress ?? '',
      profession: c.profession ?? '',
      amountPaid: Number(c.amountPaid ?? 0),
      amountToPay: Number(c.amountToPay ?? 0),
      cardCycle: Number(c.cardCycle ?? 0),
      numberOfPaymentsMade: Number(c.numberOfPaymentsMade ?? 0),
      clientCardStatus: c.clientCardStatus ?? '',
      dateJoined: c.dateJoined ?? '',
    };
  }

  /** Save edits (admin) — excludes the payments map */
  async saveCardEdits() {
    if (!this.auth.isAdmin || this.editForm.invalid) return;

    this.saving = true;
    this.saveMsg = '';
    this.saveOk = false;

    try {
      const docId = (this.clientCard as any)?.uid;
      if (!docId) throw new Error('clientCard.uid manquant');

      // Prepare payload (keep payments untouched; coerce numerics back to strings if your schema uses strings)
      const v = this.editForm.value;

      const updatePayload: Partial<Card> = {
        firstName: v.firstName?.trim(),
        lastName: v.lastName?.trim(),
        middleName: v.middleName?.trim(),
        phoneNumber: v.phoneNumber?.trim(),
        businessAddress: v.businessAddress?.trim(),
        homeAddress: v.homeAddress?.trim(),
        profession: v.profession?.trim(),

        // If your Firestore schema stores these as strings, stringify:
        amountPaid: String(v.amountPaid ?? '0'),
        amountToPay: String(v.amountToPay ?? '0'),
        cardCycle: String(v.cardCycle ?? '0'),
        numberOfPaymentsMade: String(v.numberOfPaymentsMade ?? '0'),

        clientCardStatus: v.clientCardStatus ?? '',
        dateJoined: v.dateJoined ?? this.clientCard.dateJoined,
        // payments:  // ← intentionally omitted
      };

      const path = `users/${this.auth.currentUser.uid}/cards/${docId}`;
      await this.afs.doc(path).update(updatePayload);

      // Update local model (so UI above reflects instantly)
      Object.assign(this.clientCard, updatePayload);
      this.computeAmountToGiveClient();

      this.saveOk = true;
      this.saveMsg = 'Modifications enregistrées ✅';
    } catch (e: any) {
      console.error(e);
      this.saveOk = false;
      this.saveMsg =
        'Échec de l’enregistrement : ' + (e?.message || 'Erreur inconnue');
    } finally {
      this.saving = false;
    }
  }

  reloadFromServer() {
    // Reuse your existing loader; it will patch the form on completion.
    this.retrieveClientCard();

    // Optional: small UX hint
    this.saveOk = true;
    this.saveMsg = 'Données rechargées.';
    setTimeout(() => (this.saveMsg = ''), 2000);
  }
}
