import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Audit } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';

interface QuizQuestion {
  question: string;
  answers: string[];
  correctAnswerIndex: number;
}
@Component({
  selector: 'app-questions',
  templateUrl: './questions.component.html',
  styleUrls: ['./questions.component.css'],
})
export class QuestionsComponent implements OnInit {
  constructor(
    private afs: AngularFirestore,
    public auth: AuthService,
    private data: DataService,
    private storage: AngularFireStorage
  ) {}
  audits: Audit[] = [];
  url: string = '';
  auditInfo: any;
  auditPlaceholderImage = 'assets/audit-placeholder.png';
  clientPlaceholderImage = 'assets/client-placeholder.png';

  // STATE for editing
  editAuditId: string | null = null; // which auditor is being edited
  editName: string = ''; // holds new name
  editPhoneNumber: string = ''; // holds new phoneNumber

  ngOnInit(): void {
    this.auth.getAuditInfo().subscribe((data) => {
      // this.auditInfo = data[0];
      this.audits = data;
      // this.audits = this.auditInfo;
      console.log('this.auditInfo', this.audits);
    });
  }

  onAddAudit() {
    // placeholder for your logic to add a new auditor
    alert('Add auditor logic goes here');
  }
  // Toggle the tooltip for a given auditor
  toggleEditTooltip(audit: Audit) {
    // if we're already editing this audit, close the tooltip
    if (this.editAuditId === audit.id) {
      this.editAuditId = null;
    } else {
      // open the tooltip for the clicked audit
      this.editAuditId = audit.id!;
      // set the local fields to the existing values
      this.editName = audit.name!;
      this.editPhoneNumber = audit.phoneNumber!;
    }
  }

  // Save the changed name/phoneNumber
  async saveAuditEdits(audit: Audit) {
    try {
      // create an updated object
      const updatedAudit: Audit = {
        ...audit,
        name: this.editName,
        phoneNumber: this.editPhoneNumber,
      };

      // call your data service method
      await this.data.updateAuditInfo(updatedAudit);

      // Hide the tooltip after saving
      this.editAuditId = null;
    } catch (error) {
      console.error('Error saving audit info:', error);
      // optionally show an error message
    }
  }

  onEditAudit(audit: any) {
    // placeholder for your logic to edit auditor's info
    alert(`Edit auditor: ${audit.name}`);
  }

  onDeleteAudit(audit: any) {
    // placeholder for your logic to delete an auditor
    alert(`Delete auditor: ${audit.name}`);
  }

  async startUpload(event: FileList, audit: Audit) {
    console.log('current employee', audit);
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file?.type.split('/')[0] !== 'image') {
      alert('Unsupported file type. Please upload a PDF.');
      return;
    }

    // the size cannot be greater than 10mb
    if (file?.size >= 10000000) {
      alert(
        "L'image est trop grande. La Taille maximale du fichier est de 20MB"
      );
      return;
    }
    const path = `avatar/${audit.name}-}-Audit`;

    // this.task = await this.storage.upload(path, file);
    const uploadTask = await this.storage.upload(path, file);
    this.url = await uploadTask.ref.getDownloadURL();
    uploadTask.totalBytes;

    this.data.updateAuditPictureData(audit, this.url);
  }
  onImageClick(index: number): void {
    const fileInput = document.getElementById(
      'getFile' + index
    ) as HTMLInputElement;
    fileInput.click();
  }
}
