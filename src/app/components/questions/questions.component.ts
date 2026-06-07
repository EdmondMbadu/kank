import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Audit } from 'src/app/models/management';
import { User } from 'src/app/models/user';
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
export class QuestionsComponent implements OnInit, OnDestroy {
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
  private usersSub?: Subscription;
  private clientSubs: Subscription[] = [];
  private globalClientIndex = new Map<string, Client>();

  ngOnInit(): void {
    this.auth.getAuditInfo().subscribe((data) => {
      this.audits = Array.isArray(data)
        ? (data.filter(Boolean) as Audit[])
        : [];
      this.retrieveClients();
    });
  }

  ngOnDestroy(): void {
    this.usersSub?.unsubscribe();
    this.clearClientSubscriptions();
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
    this.usersSub?.unsubscribe();
    this.clearClientSubscriptions();
    this.clients = [];
    this.globalClientIndex.clear();

    if (!this.audits.length) return;

    this.usersSub = this.auth.getAllUsersInfo().subscribe((users) => {
      const scopedUsers = this.usersForPendingLocations(users || []);
      this.clearClientSubscriptions();
      this.clients = [];
      this.globalClientIndex.clear();

      if (!scopedUsers.length) {
        this.matchPendingClients();
        return;
      }

      scopedUsers.forEach((user) => {
        if (!user.uid) return;
        const sub = this.auth.getClientsOfAUser(user.uid).subscribe((clients) => {
          this.replaceOwnerClients(user, clients || []);
          this.matchPendingClients();
        });
        this.clientSubs.push(sub);
      });
    });
  }

  private usersForPendingLocations(users: User[]): User[] {
    const pendingLocations = new Set<string>();
    this.audits.forEach((audit) => {
      (audit.pendingClients || []).forEach((pc) => {
        const location = (pc?.clientLocation || '').trim().toLowerCase();
        if (location) pendingLocations.add(location);
      });
    });

    if (!pendingLocations.size) {
      return users.filter((user) => !!user.uid);
    }

    const scoped = users.filter((user) =>
      pendingLocations.has((user.firstName || '').trim().toLowerCase())
    );
    return scoped.length ? scoped : users.filter((user) => !!user.uid);
  }

  private replaceOwnerClients(owner: User, clients: Client[]): void {
    this.clients = this.clients.filter(
      (client: any) => client.locationOwnerId !== owner.uid
    );

    const tagged = clients.filter(Boolean).map((client, index) => ({
      ...client,
      locationName: client.locationName || owner.firstName,
      locationOwnerId: client.locationOwnerId || owner.uid,
      __routeIndex: index,
    }));

    this.clients = this.clients.concat(tagged);
    this.rebuildGlobalClientIndex();
  }

  private rebuildGlobalClientIndex(): void {
    this.globalClientIndex.clear();

    this.clients.forEach((client) => {
      const keys = [
        client.uid,
        client.trackingId,
        this.normalizePhone(client.phoneNumber),
      ].filter(Boolean) as string[];

      keys.forEach((key) => {
        if (!this.globalClientIndex.has(key)) {
          this.globalClientIndex.set(key, client);
        }
      });
    });
  }

  private matchPendingClients(): void {
    this.audits.forEach((audit) => {
      if (!Array.isArray(audit.pendingClients)) return;

      audit.pendingClients.forEach((pc) => {
        if (!pc) return;

        const matchedClient = this.findPendingClientMatch(pc);
        if (matchedClient) {
          (pc as any).__matchedClient = matchedClient;
          const routeIndex = (matchedClient as any).__routeIndex;
          if (routeIndex !== undefined && routeIndex !== null) {
            pc.pendingId = String(routeIndex);
          }
        } else {
          (pc as any).__matchedClient = undefined;
        }
      });
    });
  }

  private findPendingClientMatch(pc: any): Client | undefined {
    const indexed = this.clientFromPendingIndex(pc);
    if (indexed) return indexed;

    const keys = [
      pc?.clientId,
      pc?.trackingId,
      this.normalizePhone(pc?.clientPhoneNumber),
    ].filter(Boolean) as string[];

    for (const key of keys) {
      const match = this.globalClientIndex.get(String(key));
      if (match) return match;
    }

    const pendingName = (pc?.clientName || '').trim().toLowerCase();
    const pendingLocation = (pc?.clientLocation || '').trim().toLowerCase();
    if (!pendingName || !pendingLocation) return undefined;

    return this.clients.find((client) => {
      const clientName = `${client.firstName || ''} ${client.lastName || ''}`
        .trim()
        .toLowerCase();
      const clientLocation = (client.locationName || '').trim().toLowerCase();
      return clientName === pendingName && clientLocation === pendingLocation;
    });
  }

  private clearClientSubscriptions(): void {
    this.clientSubs.forEach((sub) => sub.unsubscribe());
    this.clientSubs = [];
  }

  pendingClientDaysPassed(pc: any): number | null {
    const start = this.pendingClientStartDate(pc);
    if (!start) return null;

    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const startDay = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.floor(
      (todayStart.getTime() - startDay.getTime()) / msPerDay
    );
    return diff < 0 ? null : diff;
  }

  pendingClientWaitLabel(pc: any): string {
    const days = this.pendingClientDaysPassed(pc);
    if (days === null) return 'Date demande manquante';
    if (days <= 0) return "Demandé aujourd'hui";
    return days === 1
      ? '1 jour depuis demande'
      : `${days} jours depuis demande`;
  }

  pendingClientUrgencyTitle(pc: any): string {
    const days = this.pendingClientDaysPassed(pc);
    if (days === null) {
      return "Date de demande introuvable. Vérifiez le dossier client avant de prioriser.";
    }
    if (days >= 2) {
      return `${days} jours sans vérification. Plus l'attente avance, plus le client risque d'être frustré.`;
    }
    if (days === 1) {
      return "1 jour est déjà passé. À traiter avant que l'attente devienne frustrante.";
    }
    return "Nouveau dossier à vérifier aujourd'hui.";
  }

  isPendingClientDelayed(pc: any): boolean {
    const days = this.pendingClientDaysPassed(pc);
    return days !== null && days >= 2;
  }

  isPendingClientOneDay(pc: any): boolean {
    return this.pendingClientDaysPassed(pc) === 1;
  }

  isPendingClientNewToday(pc: any): boolean {
    return this.pendingClientDaysPassed(pc) === 0;
  }

  isPendingClientDateMissing(pc: any): boolean {
    return this.pendingClientDaysPassed(pc) === null;
  }

  private pendingClientStartDate(pc: any): Date | null {
    const matchedClient =
      (pc?.__matchedClient as Client | undefined) ||
      this.clientFromPendingIndex(pc);
    const candidates = [
      pc?.dateOfRequest,
      matchedClient?.dateOfRequest,
      pc?.requestedAt,
      pc?.requestCreatedAt,
      pc?.assignedAt,
      pc?.createdAt,
      pc?.pendingAt,
      matchedClient?.dateJoined,
      pc?.requestDate,
      matchedClient?.requestDate,
    ];

    for (const candidate of candidates) {
      const parsed = this.parsePendingDate(candidate);
      if (parsed) return parsed;
    }

    return null;
  }

  private pendingClientIndexedMatch(pc: any): number {
    const explicitIndex = this.pendingClientRouteIndex(pc);
    if (explicitIndex === null) return -1;
    return this.clients[explicitIndex] ? explicitIndex : -1;
  }

  private clientFromPendingIndex(pc: any): Client | undefined {
    const index = this.pendingClientRouteIndex(pc);
    if (index === null) return undefined;

    const pendingLocation = (pc?.clientLocation || '').trim().toLowerCase();
    const scopedClients = pendingLocation
      ? this.clients
          .filter(
            (client) =>
              (client.locationName || '').trim().toLowerCase() ===
              pendingLocation
          )
          .sort(
            (a: any, b: any) =>
              Number(a.__routeIndex ?? 0) - Number(b.__routeIndex ?? 0)
          )
      : this.clients;

    return scopedClients[index];
  }

  private pendingClientRouteIndex(pc: any): number | null {
    const rawCandidates = [pc?.pendingId, pc?.registerPortalId, pc?.clientIndex];
    for (const raw of rawCandidates) {
      const parsed = this.parseNonNegativeInteger(raw);
      if (parsed !== null) return parsed;
    }

    const clientIdIndex = this.parseNonNegativeInteger(pc?.clientId);
    if (clientIdIndex !== null && !this.clients.some((c) => c?.uid === pc.clientId)) {
      return clientIdIndex;
    }

    return null;
  }

  private parseNonNegativeInteger(value: any): number | null {
    if (value === undefined || value === null || value === '') return null;
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) return null;
    const parsed = Number(text);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  private matchesPendingClient(client: Client, pc: any): boolean {
    if (!client || !pc) return false;

    const pendingId = String(pc.clientId || '').trim();
    if (pendingId && (client.uid === pendingId || client.trackingId === pendingId)) {
      return true;
    }

    const pendingPhone = this.normalizePhone(pc.clientPhoneNumber);
    const clientPhone = this.normalizePhone(client.phoneNumber);
    if (pendingPhone && clientPhone && pendingPhone === clientPhone) {
      return true;
    }

    return false;
  }

  private normalizePhone(value?: string | null): string {
    return (value || '').replace(/\D+/g, '');
  }

  private parsePendingDate(value: any): Date | null {
    if (!value) return null;

    if (typeof value?.toDate === 'function') {
      const timestampDate = value.toDate();
      return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;

    const parts = raw.split(/[-/]/).map((part) => Number(part));
    if (parts.length >= 3) {
      const [month, day, year] = parts;
      const hours = Number.isFinite(parts[3]) ? parts[3] : 0;
      const minutes = Number.isFinite(parts[4]) ? parts[4] : 0;
      const seconds = Number.isFinite(parts[5]) ? parts[5] : 0;
      const parsed = new Date(year, month - 1, day, hours, minutes, seconds);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
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
