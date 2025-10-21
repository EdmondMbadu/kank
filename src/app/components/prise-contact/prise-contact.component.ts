import { Component } from '@angular/core';

type ContactFormModel = {
  firstName: string;
  middleName: string;
  lastName: string;
  phoneNumber: string;
};

type ContactEntry = ContactFormModel & {
  createdAt: Date;
  updatedAt?: Date;
};

@Component({
  selector: 'app-prise-contact',
  templateUrl: './prise-contact.component.html',
})
export class PriseContactComponent {
  contacts: ContactEntry[] = [];
  form: ContactFormModel = this.createEmptyForm();
  editingIndex: number | null = null;

  get isEditing(): boolean {
    return this.editingIndex !== null;
  }

  submit(): void {
    const trimmed = this.getTrimmedForm();
    if (!trimmed.firstName || !trimmed.lastName || !trimmed.phoneNumber) {
      return;
    }

    if (this.isEditing && this.editingIndex !== null) {
      this.contacts[this.editingIndex] = {
        ...this.contacts[this.editingIndex],
        ...trimmed,
        updatedAt: new Date(),
      };
    } else {
      this.contacts = [
        {
          ...trimmed,
          createdAt: new Date(),
        },
        ...this.contacts,
      ];
    }

    this.resetForm();
  }

  editContact(index: number): void {
    const selected = this.contacts[index];
    this.form = {
      firstName: selected.firstName,
      middleName: selected.middleName,
      lastName: selected.lastName,
      phoneNumber: selected.phoneNumber,
    };
    this.editingIndex = index;
  }

  deleteContact(index: number): void {
    this.contacts = this.contacts.filter((_, i) => i !== index);
    if (this.editingIndex === index) {
      this.resetForm();
    } else if (this.editingIndex !== null && index < this.editingIndex) {
      this.editingIndex = this.editingIndex - 1;
    }
  }

  cancelEdit(): void {
    this.resetForm();
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
    this.editingIndex = null;
  }
}
