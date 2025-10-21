import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreCollection,
} from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';

type ContactFormModel = {
  firstName: string;
  middleName: string;
  lastName: string;
  phoneNumber: string;
};

type ContactDocument = ContactFormModel & {
  createdAt: number;
  updatedAt?: number;
};

type ContactEntry = ContactDocument & {
  id: string;
};

@Component({
  selector: 'app-prise-contact',
  templateUrl: './prise-contact.component.html',
})
export class PriseContactComponent implements OnInit, OnDestroy {
  contacts: ContactEntry[] = [];
  form: ContactFormModel = this.createEmptyForm();
  editingId: string | null = null;
  searchTerm = '';
  isExplanationExpanded = false;
  private contactsCollection?: AngularFirestoreCollection<ContactDocument>;
  private userSub?: Subscription;
  private contactsSub?: Subscription;

  phoneError = '';
  successMessage = '';
  private successTimer?: ReturnType<typeof setTimeout>;

  constructor(public auth: AuthService, private afs: AngularFirestore) {}

  toggleExplanation(): void {
    this.isExplanationExpanded = !this.isExplanationExpanded;
  }

  get isEditing(): boolean {
    return this.editingId !== null;
  }

  ngOnInit(): void {
    this.userSub = this.auth.user$
      .pipe(filter((user): user is User => Boolean(user)))
      .subscribe((user) => this.initializeCollection(user));
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.contactsSub?.unsubscribe();
  }

  async submit(): Promise<void> {
    const trimmed = this.getTrimmedForm();
    this.phoneError = '';
    const missingFields: string[] = [];
    if (!trimmed.firstName) {
      missingFields.push('le prénom');
    }
    if (!trimmed.lastName) {
      missingFields.push('le nom');
    }
    if (!trimmed.phoneNumber) {
      missingFields.push('le téléphone');
      this.phoneError = 'Veuillez completer un numéro.';
    }

    if (missingFields.length) {
      window.alert(
        `Veuillez completer les champs ${missingFields
          .join(', ')
          .replace(/,([^,]*)$/, ' et$1')} avant d’enregistrer.`
      );
      return;
    }

    if (!this.isValidPhone(trimmed.phoneNumber)) {
      this.phoneError = 'Le numéro doit contenir exactement 10 chiffres.';
      window.alert(this.phoneError);
      return;
    }

    this.phoneError = '';

    if (!this.contactsCollection) {
      return;
    }

    try {
      if (this.isEditing && this.editingId) {
        await this.contactsCollection.doc(this.editingId).update({
          ...trimmed,
          updatedAt: Date.now(),
        });
      } else {
        await this.contactsCollection.add({
          ...trimmed,
          createdAt: Date.now(),
        });
      }
      this.resetForm();
      this.flashSuccess(
        this.isEditing
          ? 'Contact mis à jour avec succès.'
          : 'Contact ajouté avec succès.'
      );
    } catch (error) {
      console.error('Failed to persist contact', error);
    }
  }

  editContact(entry: ContactEntry): void {
    this.form = {
      firstName: entry.firstName,
      middleName: entry.middleName,
      lastName: entry.lastName,
      phoneNumber: entry.phoneNumber,
    };
    this.editingId = entry.id;
  }

  async deleteContact(entry: ContactEntry): Promise<void> {
    if (!this.contactsCollection) {
      return;
    }

    const confirmDelete = window.confirm(
      `Supprimer ${entry.firstName} ${entry.lastName} de la liste ?`
    );
    if (!confirmDelete) {
      return;
    }

    try {
      await this.contactsCollection.doc(entry.id).delete();
    } catch (error) {
      console.error('Failed to delete contact', error);
    }

    if (this.editingId === entry.id) {
      this.resetForm();
    }
  }

  cancelEdit(): void {
    this.resetForm();
  }

  get filteredContacts(): ContactEntry[] {
    if (!this.searchTerm.trim()) {
      return this.contacts;
    }

    const normalizedSearch = this.normalize(this.searchTerm);
    const digitSearch = normalizedSearch.replace(/\D/g, '');

    return this.contacts.filter((contact) => {
      const fullName = this.normalize(
        `${contact.firstName} ${contact.middleName ?? ''} ${contact.lastName}`
      );
      const phoneDigits = (contact.phoneNumber ?? '').replace(/\D/g, '');
      return (
        (normalizedSearch.length > 0 && fullName.includes(normalizedSearch)) ||
        (digitSearch.length > 0 && phoneDigits.includes(digitSearch))
      );
    });
  }

  get filteredTotal(): number {
    return this.filteredContacts.length;
  }

  private createEmptyForm(): ContactFormModel {
    return {
      firstName: '',
      middleName: '',
      lastName: '',
      phoneNumber: '',
    };
  }

  private getTrimmedForm(): ContactFormModel {
    return {
      firstName: this.form.firstName.trim(),
      middleName: this.form.middleName.trim(),
      lastName: this.form.lastName.trim(),
      phoneNumber: this.form.phoneNumber.trim(),
    };
  }

  private resetForm(): void {
    this.form = this.createEmptyForm();
    this.editingId = null;
  }

  private initializeCollection(user: User): void {
    this.contactsSub?.unsubscribe();

    this.contactsCollection = this.afs.collection<ContactDocument>(
      `users/${user.uid}/prise_contact`,
      (ref) => ref.orderBy('createdAt', 'desc')
    );

    this.contactsSub = this.contactsCollection
      .snapshotChanges()
      .pipe(
        map(
          (snaps) =>
            snaps.map((snap) => {
              const data = snap.payload.doc.data();
              return {
                id: snap.payload.doc.id,
                ...data,
                createdAt: this.coerceToMillis(data.createdAt),
                updatedAt: data.updatedAt
                  ? this.coerceToMillis(data.updatedAt)
                  : undefined,
              };
            }) as ContactEntry[]
        )
      )
      .subscribe((contacts) => {
        this.contacts = contacts;
      });
  }

  private coerceToMillis(value: any): number {
    if (!value) {
      return Date.now();
    }
    if (typeof value === 'number') {
      return value;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value.toDate === 'function') {
      return value.toDate().getTime();
    }
    return Date.now();
  }

  private isValidPhone(value: string): boolean {
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length === 10 && /^\d{10}$/.test(value);
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private flashSuccess(message: string): void {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
    this.successMessage = message;
    this.successTimer = setTimeout(() => {
      this.successMessage = '';
    }, 2500);
  }
}
