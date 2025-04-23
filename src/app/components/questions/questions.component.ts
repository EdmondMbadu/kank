import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
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
    private storage: AngularFireStorage,
    private router: Router
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

  // For the "Add Auditor" form
  showAddAuditorForm: boolean = false;
  newAuditorName: string = '';
  newAuditorPhone: string = '';
  clients: Client[] = [];
  ngOnInit(): void {
    this.auth.getAuditInfo().subscribe((data) => {
      // this.auditInfo = data[0];
      this.audits = data;
      // this.audits = this.auditInfo;
      console.log('this.auditInfo', this.audits);
      this.retrieveClients();
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
  // Toggle the "Add Auditor" pop-up
  toggleAddAuditForm(): void {
    this.showAddAuditorForm = !this.showAddAuditorForm;
    // Clear fields if closing
    if (!this.showAddAuditorForm) {
      this.newAuditorName = '';
      this.newAuditorPhone = '';
    }
  }
  // Create the new auditor
  onCreateAudit(): void {
    if (!this.newAuditorName.trim() || !this.newAuditorPhone.trim()) {
      alert('Please fill in both Name and Phone Number');
      return;
    }

    const auditorData: Partial<Audit> = {
      name: this.newAuditorName.trim(),
      phoneNumber: this.newAuditorPhone.trim(),
      profilePicture: '',
      pendingClients: [],
    };

    this.data
      .createAudit(auditorData)
      .then(() => {
        console.log('Auditor created successfully!');
        // Optionally close the form
        this.toggleAddAuditForm();
      })
      .catch((err) => console.error('Error creating auditor:', err));
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

  removePendingClient(audit: Audit, client: any) {
    if (!confirm(`Supprimer ${client.clientName} ?`)) return;

    // build the trimmed array
    const updatedPending = audit.pendingClients!.filter(
      (pc) => pc.clientId !== client.clientId
    );

    // persist only the pendingClients field
    this.data
      .updateAuditPendingClients(audit.id!, updatedPending)
      .then(() => {
        // reflect the change immediately in the UI
        audit.pendingClients = updatedPending;
      })
      .catch((err) => {
        console.error('Erreur suppression client :', err);
        alert('Impossible de retirer ce client, veuillez réessayer.');
      });
  }

  onEditAudit(audit: any) {
    // placeholder for your logic to edit auditor's info
    alert(`Edit auditor: ${audit.name}`);
  }

  onDeleteAudit(audit: Audit) {
    if (confirm(`Are you sure you want to delete auditor "${audit.name}"?`)) {
      this.data
        .deleteAudit(audit.id!)
        .then(() => {
          console.log('Audit document successfully deleted!');
        })
        .catch((error) => {
          console.error('Error deleting auditor:', error);
        });
    }
  }
  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      console.log('this.clients', this.clients);

      // Match each pendingClient with an actual client by ID
      this.audits.forEach((audit) => {
        if (!audit.pendingClients) return;

        audit.pendingClients.forEach((pc) => {
          // Find the index of the client whose uid matches pc.clientId
          const matchIndex = this.clients.findIndex(
            (c) => c.uid === pc.clientId
          );

          if (matchIndex !== -1) {
            // Store the index as the pendingId
            pc.pendingId = matchIndex.toString();
          }
        });
      });
    });
  }

  // For jumping to the client's register portal
  goToClientPortal(audit: Audit, pc: any) {
    if (this.auth.currentUser.firstName === pc.clientLocation) {
      if (pc.pendingId) {
        // If you have Angular Router:
        this.router.navigate(['/register-portal', pc.pendingId]);
        // alert(`Navigating to /register-portal/${pc.pendingId}`);
      } else {
        alert('No matching client found, or no pendingId set.');
      }
    } else {
      // Show popup or alert
      alert(
        `Vous n'êtes pas au bon endroit. Veuillez accéder à ${pc.clientLocation} pour accéder à ce client.`
      );
    }
  }

  // ...existing createAudit, edit, delete, etc. methods...

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
