import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreCollection,
} from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { MessagingService } from 'src/app/services/messaging.service';

type ContactFormFields = {
  firstName: string;
  middleName: string;
  lastName: string;
  phoneNumber: string;
};

type ContactFormModel = ContactFormFields & {
  originTagsInput: string;
};

type ContactDocument = ContactFormFields & {
  createdAt: number;
  updatedAt?: number;
  /** NEW: normalized digits-only phone (for uniqueness checks) */
  phoneDigits?: string;
  /** NEW: capture where this recruit comes from */
  originTags?: string[];
  /** Track owner to support admin aggregation */
  ownerId?: string;
  ownerName?: string;
};

type ContactEntry = ContactDocument & {
  id: string;
  docPath: string;
};

type TagOption = { label: string; value: string };

type BulkFailure = { contact: ContactEntry; error: string };
type BulkResult = {
  total: number;
  succeeded: number;
  failed: number;
  failures: BulkFailure[];
};

@Component({
  selector: 'app-prise-contact',
  templateUrl: './prise-contact.component.html',
})
export class PriseContactComponent implements OnInit, OnDestroy {
  contacts: ContactEntry[] = [];
  form: ContactFormModel = this.createEmptyForm();
  editingId: string | null = null;
  private editingDocPath: string | null = null;
  searchTerm = '';
  isExplanationExpanded = false;
  availableTags: TagOption[] = [];
  private selectedTagValues = new Set<string>();

  bulkModal = {
    open: false,
    message: '' as string,
    recipients: [] as ContactEntry[],
    excludedNoPhone: 0,
    result: null as BulkResult | null,
  };
  bulkSending = false;
  placeholderTokens = ['{{FULL_NAME}}', '{{firstName}}', '{{lastName}}', '{{TAGS}}'];

  private currentUser?: User;
  private contactsCollection?: AngularFirestoreCollection<ContactDocument>;
  private userSub?: Subscription;
  private contactsSub?: Subscription;

  phoneError = '';
  successMessage = '';
  private successTimer?: ReturnType<typeof setTimeout>;

  constructor(
    public auth: AuthService,
    private afs: AngularFirestore,
    private messaging: MessagingService
  ) {}

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
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  /** Helper: keep only digits for comparison/storage */
  private getPhoneDigits(value: string): string {
    return (value || '').replace(/\D/g, '');
  }

  async submit(): Promise<void> {
    const trimmed = this.getTrimmedForm();
    this.phoneError = '';

    const missingFields: string[] = [];
    if (!trimmed.firstName) missingFields.push('le prénom');
    if (!trimmed.lastName) missingFields.push('le nom');
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

    if (!this.contactsCollection) {
      return;
    }

    const { originTagsInput, ...baseFields } = trimmed;
    const originTags = this.parseTags(originTagsInput);

    // === DUPLICATE CHECKS ===
    const phoneDigits = this.getPhoneDigits(trimmed.phoneNumber);

    // 1) Local (quick) check: block if another contact already has this number
    const duplicateLocal = this.contacts.some((c) => {
      const same = this.getPhoneDigits(c.phoneNumber) === phoneDigits;
      const notSelf = !this.isEditing || c.id !== this.editingId;
      return same && notSelf;
    });
    if (duplicateLocal) {
      this.phoneError = 'Ce numéro existe déjà dans vos contacts.';
      window.alert(
        'Ce numéro existe déjà dans vos contacts — ajout/modification annulé(e).'
      );
      return;
    }

    // 2) Firestore (authoritative) check to avoid race conditions
    try {
      const querySnapshot = this.auth.isAdmin
        ? await this.afs.firestore
            .collectionGroup('prise_contact')
            .where('phoneDigits', '==', phoneDigits)
            .limit(2)
            .get()
        : await this.contactsCollection.ref
            .where('phoneDigits', '==', phoneDigits)
            .limit(2)
            .get();

      const conflictingDoc = querySnapshot.docs.find(
        (doc) => doc.ref.path !== this.editingDocPath
      );
      if (conflictingDoc) {
        this.phoneError = 'Ce numéro existe déjà dans vos contacts.';
        window.alert(
          'Ce numéro existe déjà dans vos contacts — ajout/modification annulé(e).'
        );
        return;
      }
    } catch (e) {
      console.warn('Duplicate check skipped (fallback to local data):', e);
      // continue with local validation result only
    }
    // === END DUPLICATE CHECKS ===

    try {
      if (this.isEditing && this.editingDocPath) {
        await this.afs.doc<ContactDocument>(this.editingDocPath).update({
          ...baseFields,
          originTags,
          phoneDigits,
          updatedAt: Date.now(),
        });
      } else {
        await this.contactsCollection.add({
          ...baseFields,
          originTags,
          phoneDigits,
          createdAt: Date.now(),
          ownerId: this.currentUser?.uid || this.auth.currentUser?.uid || undefined,
          ownerName:
            this.currentUser?.firstName ||
            this.auth.currentUser?.firstName ||
            undefined,
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
      originTagsInput: (entry.originTags ?? []).join(', '),
    };
    this.editingId = entry.id;
    this.editingDocPath = entry.docPath;
  }

  async deleteContact(entry: ContactEntry): Promise<void> {
    const confirmDelete = window.confirm(
      `Supprimer ${entry.firstName} ${entry.lastName} de la liste ?`
    );
    if (!confirmDelete) return;

    try {
      await this.afs.doc<ContactDocument>(entry.docPath).delete();
    } catch (error) {
      console.error('Failed to delete contact', error);
    }

    if (this.editingId === entry.id) this.resetForm();
  }

  cancelEdit(): void {
    this.resetForm();
  }

  onSearchTermChange(): void {
    this.handleFiltersChanged();
  }

  toggleTag(option: TagOption): void {
    if (!this.auth.isAdmin) return;
    if (this.selectedTagValues.has(option.value)) {
      this.selectedTagValues.delete(option.value);
    } else {
      this.selectedTagValues.add(option.value);
    }
    this.handleFiltersChanged();
  }

  clearTagFilters(): void {
    this.selectedTagValues.clear();
    this.handleFiltersChanged();
  }

  isTagSelected(value: string): boolean {
    return this.selectedTagValues.has(value);
  }

  get hasActiveTagFilter(): boolean {
    return this.selectedTagValues.size > 0;
  }

  openBulkModal(): void {
    if (!this.auth.isAdmin) return;
    this.bulkModal.open = true;
    this.bulkModal.result = null;
    this.bulkModal.message = this.defaultBulkTemplate();
    this.updateBulkRecipients();
  }

  closeBulkModal(): void {
    this.bulkModal.open = false;
    this.bulkModal.message = '';
    this.bulkModal.recipients = [];
    this.bulkModal.excludedNoPhone = 0;
    this.bulkModal.result = null;
    this.bulkSending = false;
  }

  updateBulkRecipients(): void {
    if (!this.auth.isAdmin) return;
    const withPhones: ContactEntry[] = [];
    let excluded = 0;

    for (const contact of this.filteredContacts) {
      if (this.hasDialablePhone(contact)) {
        withPhones.push(contact);
      } else {
        excluded += 1;
      }
    }

    this.bulkModal.recipients = withPhones;
    this.bulkModal.excludedNoPhone = excluded;
  }

  async sendBulkMessages(): Promise<void> {
    if (
      !this.auth.isAdmin ||
      this.bulkSending ||
      !this.bulkModal.open ||
      !this.bulkModal.message?.trim() ||
      this.bulkModal.recipients.length === 0
    ) {
      return;
    }

    this.bulkSending = true;
    const failures: BulkFailure[] = [];
    let succeeded = 0;

    for (const contact of this.bulkModal.recipients) {
      try {
        const text = this.personalizeBulkMessage(
          this.bulkModal.message,
          contact
        );
        await this.messaging.sendCustomSMS(contact.phoneNumber, text, {
          reason: 'admin_prospect_bulk_sms',
          contactId: contact.id,
          contactOwnerId: contact.ownerId ?? null,
        });
        succeeded += 1;
      } catch (error: any) {
        console.error('Bulk SMS error', error);
        failures.push({
          contact,
          error: error?.message || 'Échec d’envoi',
        });
      }
    }

    this.bulkModal.result = {
      total: this.bulkModal.recipients.length,
      succeeded,
      failed: failures.length,
      failures,
    };

    this.bulkSending = false;
  }

  get bulkPreviewMessage(): string {
    const first = this.bulkModal.recipients?.[0];
    if (!first || !this.bulkModal.message?.trim()) return '';
    return this.personalizeBulkMessage(this.bulkModal.message, first);
  }

  get filteredContacts(): ContactEntry[] {
    const search = this.searchTerm.trim();
    let base = this.contacts;

    if (this.auth.isAdmin && this.selectedTagValues.size > 0) {
      base = base.filter((contact) => {
        const tags = (contact.originTags ?? []).map((tag) =>
          this.normalizeTag(tag)
        );
        return tags.some((tag) => this.selectedTagValues.has(tag));
      });
    }

    if (!search) return base;

    const normalizedSearch = this.normalize(search);
    const digitSearch = normalizedSearch.replace(/\D/g, '');

    return base.filter((contact) => {
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

  private handleFiltersChanged(): void {
    if (this.auth.isAdmin && this.bulkModal.open) {
      this.updateBulkRecipients();
    }
  }

  private parseTags(input: string): string[] {
    if (!input) return [];
    const tags = input
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    return Array.from(new Set(tags));
  }

  private updateAvailableTags(): void {
    const map = new Map<string, string>();
    this.contacts.forEach((contact) => {
      (contact.originTags ?? []).forEach((tag) => {
        const normalized = this.normalizeTag(tag);
        if (!normalized) return;
        if (!map.has(normalized)) map.set(normalized, tag);
      });
    });

    this.availableTags = Array.from(map.entries())
      .map(([value, label]) => ({
        value,
        label,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const allowed = new Set(this.availableTags.map((option) => option.value));
    Array.from(this.selectedTagValues).forEach((value) => {
      if (!allowed.has(value)) this.selectedTagValues.delete(value);
    });
  }

  private normalizeTag(tag: string): string {
    return tag ? tag.trim().toLowerCase() : '';
  }

  private extractOwnerIdFromPath(path: string): string | undefined {
    const match = /^users\/([^/]+)\/prise_contact\/[^/]+$/.exec(path);
    return match?.[1];
  }

  private defaultBulkTemplate(): string {
    return `Bonjour {{FULL_NAME}},
Nous serions ravis de vous accueillir chez Fondation Gervais.
Passez nous voir pour finaliser votre inscription.`;
  }

  private personalizeBulkMessage(
    template: string,
    contact: ContactEntry
  ): string {
    if (!template) return '';
    const tagsLabel = (contact.originTags ?? []).join(', ');
    return template
      .replace(/{{FULL_NAME}}/g, `${contact.firstName} ${contact.lastName}`.trim())
      .replace(/{{firstName}}/g, contact.firstName || '')
      .replace(/{{lastName}}/g, contact.lastName || '')
      .replace(/{{TAGS}}/g, tagsLabel);
  }

  private hasDialablePhone(contact: ContactEntry): boolean {
    const digits = this.getPhoneDigits(contact.phoneNumber);
    return digits.length === 10;
  }

  private createEmptyForm(): ContactFormModel {
    return {
      firstName: '',
      middleName: '',
      lastName: '',
      phoneNumber: '',
      originTagsInput: '',
    };
  }

  private getTrimmedForm(): ContactFormModel {
    return {
      firstName: this.form.firstName.trim(),
      middleName: this.form.middleName.trim(),
      lastName: this.form.lastName.trim(),
      phoneNumber: this.form.phoneNumber.trim(),
      originTagsInput: this.form.originTagsInput.trim(),
    };
  }

  private resetForm(): void {
    this.form = this.createEmptyForm();
    this.editingId = null;
    this.editingDocPath = null;
    this.phoneError = '';
  }

  private initializeCollection(user: User): void {
    this.contactsSub?.unsubscribe();
    this.currentUser = user;

    this.contactsCollection = this.afs.collection<ContactDocument>(
      `users/${user.uid}/prise_contact`,
      (ref) => ref.orderBy('createdAt', 'desc')
    );

    const collection$ = this.auth.isAdmin
      ? this.afs
          .collectionGroup<ContactDocument>('prise_contact', (ref) =>
            ref.orderBy('createdAt', 'desc')
          )
          .snapshotChanges()
      : this.contactsCollection.snapshotChanges();

    this.contactsSub = collection$
      .pipe(
        map((snaps) =>
          snaps.map((snap) => {
            const data = snap.payload.doc.data();
            const docPath = snap.payload.doc.ref.path;
            const rawTags = Array.isArray(data.originTags)
              ? (data.originTags as string[])
              : [];
            const cleanedTags = rawTags
              .map((tag) => tag?.toString?.() ?? '')
              .map((tag) => tag.trim())
              .filter((tag) => !!tag);

            const contact: ContactEntry = {
              id: snap.payload.doc.id,
              docPath,
              firstName: data.firstName,
              middleName: data.middleName ?? '',
              lastName: data.lastName,
              phoneNumber: data.phoneNumber,
              createdAt: this.coerceToMillis(data.createdAt),
              updatedAt: data.updatedAt
                ? this.coerceToMillis(data.updatedAt)
                : undefined,
              phoneDigits: data.phoneDigits,
              originTags: cleanedTags,
              ownerId: data.ownerId ?? this.extractOwnerIdFromPath(docPath),
              ownerName: data.ownerName,
            };
            return contact;
          })
        )
      )
      .subscribe((contacts) => {
        this.contacts = contacts;
        this.updateAvailableTags();
        if (this.auth.isAdmin && this.bulkModal.open) {
          this.updateBulkRecipients();
        }
      });
  }

  private coerceToMillis(value: any): number {
    if (!value) return Date.now();
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
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
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successMessage = message;
    this.successTimer = setTimeout(() => {
      this.successMessage = '';
    }, 2500);
  }
}
