import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client, Comment } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Audit } from 'src/app/models/management';

@Component({
  selector: 'app-register-portal',
  templateUrl: './register-portal.component.html',
  styleUrls: ['./register-portal.component.css'],
})
export class RegiserPortalComponent {
  readonly auditAudioAccept =
    '.m4a,.mp3,.wav,.aac,.caf,.aif,.aiff,.amr,.flac,.ogg,.webm,.3gp,.3gpp,.3gpp2,.mp4,audio/mp4,audio/x-m4a,audio/aac,audio/mpeg,audio/wav,audio/x-wav,audio/aiff,audio/x-aiff,audio/3gpp,audio/3gpp2,audio/amr,audio/flac,audio/ogg,audio/webm,audio/*';
  readonly auditConversationInlineInputId = 'auditConversationAudioInline';
  readonly auditConversationModalInputId = 'auditConversationAudioModal';
  private readonly supportedAudioExtensions = new Set([
    'm4a',
    'mp3',
    'wav',
    'aac',
    'caf',
    'aif',
    'aiff',
    'amr',
    'flac',
    'ogg',
    'webm',
    '3gp',
    '3gpp',
    '3gpp2',
    'mp4',
  ]);
  // === Performance Ring shared state ===
  size = 260;
  strokeWidth = 16;
  center = this.size / 2;
  radius2 = this.center - this.strokeWidth / 2;

  // unique gradient IDs for the two rings
  gradIdCredit = `gradPerfRingC-${Math.random().toString(36).slice(2)}`;
  gradIdWorth = `gradPerfRingW-${Math.random().toString(36).slice(2)}`;

  // tick angles (every 10%)
  ticks: number[] = Array.from({ length: 10 }, (_, i) => i * 36);

  // Month/Year label
  currentMonth = new Date().getMonth();
  currentYear = new Date().getFullYear();
  monthFrenchNames = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ];

  // Clamp + compute stroke dasharray for any value
  progressDasharrayFor(val: number): string {
    const v = Math.max(0, Math.min(100, val ?? 0));
    const c = 2 * Math.PI * this.radius2;
    const filled = c * (v / 100);
    return `${filled} ${c - filled}`;
  }

  // Use ComputationService's gradient
  colorForPerf(v: number): string {
    const clamped = Math.max(0, Math.min(100, v ?? 0));
    return this.compute.getGradientColor(clamped);
  }

  // Convenient getters for values
  get creditScoreValue(): number {
    const raw = Number(this.client?.creditScore);
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
  }

  get worthinessValue(): number {
    const raw = Number(this.client?.creditworthinessScore);
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
  }

  client = new Client();
  minPay = '';
  employees: Employee[] = [];
  agent?: Employee = { firstName: '-' };
  url: string = '';
  agentVerifyingName: string = '';
  agentSubmmittedVerification: string = '';
  age: number | null = null; // ← nouveau
  birthDateDisplay = '';

  showPhoneHistory = false;
  copied?: string;

  @ViewChild('phoneHistory', { static: false }) phoneHistoryRef?: ElementRef;

  showAuditConfirmation: boolean = false;
  showAuditConversation = false;
  isConfirmed: boolean = false;
  audits: Audit[] = [];
  suspiciousReason = '';
  similarClients: Array<{ link: string; label: string; overlap: number }> = [];
  showSimilarClients = true;

  // ====== Nouveaux champs ======
  showRefundDialog = false;
  selectedReturnDate = ''; // ISO yyyy-MM-dd (lié à l’input date)
  minReturnDate = ''; // ISO de demain (initialisé dans ngOnInit)

  id: any = '';
  paymentDate = '';
  debtStart = '';
  requestDate = '';
  debtEnd = '';
  worhty? = '';
  savings: string = '0';
  public graphWorthiness = {
    data: [
      {
        domain: { x: [0, 1], y: [0, 1] },
        value: 270,
        title: { text: 'Speed' },
        type: 'indicator',
        mode: 'gauge+number',
        gauge: {
          axis: { range: [0, 100], tickcolor: 'blue' }, // Color of the ticks (optional)
          bar: { color: 'blue' }, // Single color for the gauge bar (needle)
        },
      },
    ],
    layout: {
      margin: { t: 0, b: 0, l: 0, r: 0 }, // Adjust margins
      responsive: true, // Make the chart responsive
    },
  };
  toast: any;
  dateJoined: string = '';
  /** Cherche les autres clients partageant ≥ 2 noms avec celui affiché.
   *  currentIdx  = index (position) du client courant dans `all`.
   *  all         = tableau complet des clients.
   *  Met à jour `similarClients` (avec le nombre de noms en commun) et `suspiciousReason`. */
  private detectSuspicious(currentIdx: number, all: Client[]): void {
    const norm = (s?: string) => (s ?? '').trim().toLowerCase();
    const cur = all[currentIdx];
    const curNames = [
      norm(cur.firstName),
      norm(cur.middleName),
      norm(cur.lastName),
    ];

    const matches = all
      .map((other, i) => {
        if (i === currentIdx) {
          return null;
        }
        const otherNames = [
          norm(other.firstName),
          norm(other.middleName),
          norm(other.lastName),
        ];
        const overlap = curNames.filter(
          (n) => n && otherNames.includes(n)
        ).length;

        if (overlap >= 2) {
          const displayName = [other.firstName, other.middleName, other.lastName]
            .filter((part) => !!part?.trim())
            .join(' ');

          return {
            link: `/client-portal/${i}`,
            label: displayName || 'Client inconnu',
            overlap,
          };
        }
        return null;
      })
      .filter(
        (entry): entry is { link: string; label: string; overlap: number } =>
          entry !== null
      )
      .sort((a, b) => b.overlap - a.overlap || a.label.localeCompare(b.label));

    this.similarClients = matches;
    this.suspiciousReason = matches.length
      ? '2 noms similaires à un client déjà dans le système'
      : '';
  }

  public graphCredit = {
    data: [
      {
        domain: { x: [0, 1], y: [0, 1] },
        value: 270,
        title: { text: 'Speed' },
        type: 'indicator',
        mode: 'gauge+number',
        gauge: {
          axis: { range: [0, 100], tickcolor: 'blue' }, // Color of the ticks (optional)
          bar: { color: 'blue' }, // Single color for the gauge bar (needle)
        },
      },
    ],
    layout: {
      margin: { t: 0, b: 0, l: 0, r: 0 }, // Adjust margins
      responsive: true, // Make the chart responsive
    },
  };
  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private time: TimeService,
    private data: DataService,
    private compute: ComputationService,
    private storage: AngularFireStorage
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  isFullPictureVisible = false;

  /** Open / close the full-screen photo viewer */
  toggleFullPicture(): void {
    this.isFullPictureVisible = !this.isFullPictureVisible;
  }
  ngOnInit(): void {
    this.retrieveClient();
    this.minReturnDate = this.time.getTomorrowsDateISO();
  }
  comment?: string = 'RAISON DU REFUS: ';

  comments: Comment[] = [];
  isRecording = false;
  personPostingComment?: string = '';
  mediaRecorder!: MediaRecorder;
  audioChunks: BlobPart[] = []; // Will store the recorded audio data (chunks)
  recordedBlob?: Blob; // Final audio blob
  recordedAudioURL?: string; // Local blob URL for playback in the UI
  commentAudioUrl: string = ''; // Final upload URL from Firebase
  selectedAuditAudioFile?: File;
  selectedAuditAudioPreviewUrl?: string;
  auditAudioUploading = false;
  auditVerificationSaving = false;

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      const idx = Number(this.id); // position du client courant
      this.client = data[idx];
      this.age = this.compute.computeAge(this.client.birthDate);
      this.birthDateDisplay = this.formatBirthDate(this.client.birthDate);
      // … (votre logique existante) …
      this.detectSuspicious(idx, data);
      console.log('the client', this.client);
      this.auth.getAuditInfo().subscribe((data) => {
        // this.auditInfo = data[0];
        this.audits = data;
        // this.audits = this.auditInfo;
        console.log('this.auditInfo', this.audits);

        //    Assuming the field is named `clientId`.
        const matchingAudit = this.audits.find((audit) => {
          if (!audit.pendingClients) return false;
          return audit.pendingClients.some(
            (pc) => pc.clientId === this.client.uid
          );
        });

        // 4) If found, store that audit's name in agentVerifyingName
        if (matchingAudit) {
          this.agentVerifyingName = matchingAudit.name!;
          console.log('Matching audit found:', matchingAudit);
          // optionally, also store it in the client object if desired:
          // this.client.agentVerifyingName = matchingAudit.name;
        }
      });
      // 3) Find the audit that has a pendingClient with this client's ID

      this.setGraphCredit();
      this.setFields();
      this.setComments();
      this.setGraphWorthiness();
      this.client.debtCycle =
        this.client.debtCycle === undefined || this.client.debtCycle === '0'
          ? '1'
          : this.client.debtCycle;
      this.requestDate = this.time.convertDateToDayMonthYear(
        this.client.requestDate!
      );
    });
  }

  private formatBirthDate(birth?: string | null): string {
    if (!birth) {
      return '';
    }
    const parts = birth.split('-');
    if (parts.length !== 3) {
      return birth;
    }
    const [dayStr, monthStr, yearStr] = parts;
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = Number(yearStr);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
      return birth;
    }
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
      return birth;
    }
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  setComments() {
    if (this.client.comments) {
      this.comments = this.client.comments;
      // add the formatted time
      this.comments.forEach((comment) => {
        comment.timeFormatted = this.time.convertDateToDesiredFormat(
          comment.time!
        );
      });
    }
    this.comments.sort((a: any, b: any) => {
      const parseTime = (time: string) => {
        const [month, day, year, hour, minute, second] = time
          .split('-')
          .map(Number);
        return new Date(year, month - 1, day, hour, minute, second).getTime();
      };

      const dateA = parseTime(a.time);
      const dateB = parseTime(b.time);
      return dateB - dateA; // Descending order
    });
  }

  startNewDebtCycle() {
    if (this.client.amountPaid !== this.client.amountToPay) {
      alert(
        `Vous devez encore FC ${this.client.debtLeft}. Terminez d'abord ce cycle.`
      );
      return;
    } else {
      this.router.navigate(['/debt-cycle/' + this.id]);
    }
  }
  withDrawFromSavings() {
    if (this.client.savings === '0') {
      alert("Vous n'avez pas d'argent !");
      return;
    } else {
      this.router.navigate(['/withdraw-savings/' + this.id]);
    }
  }

  // delete() {
  //   let result = confirm('Êtes-vous sûr de vouloir supprimer ce client?');
  //   if (!result) {
  //     return;
  //   }
  //   this.auth
  //     .deleteClient(this.client)
  //     .then(() => {
  //       alert('Client supprimé avec succès !');
  //       this.router.navigate(['/client-info/']);
  //     })
  //     .catch((error) => {
  //       alert('Error deleting client: ');
  //     });

  //   this.auth
  //     .UpdateUserInfoForDeletedRegisterClient(this.client)
  //     .then(() => {
  //       console.log('updated user info');
  //     })
  //     .catch((error) => {
  //       alert('Error deleting client: ');
  //     });
  // }

  toggle(property: 'showAuditConfirmation' | 'isConfirmed') {
    this[property] = !this[property];
  }
  confirmAudit() {
    this.showAuditConfirmation = true;
    this.isConfirmed = false;
  }

  closeAuditConfirmation(): void {
    this.showAuditConfirmation = false;
    this.isConfirmed = false;
  }
  async cancelRegistration() {
    let total =
      Number(this.client.savings) +
      Number(this.client.membershipFee) +
      Number(this.client.applicationFee);
    let result = confirm(
      `Êtes-vous sûr de vouloir annuler l'enregistrement?. Cela entraînera le retour de tout l'argent aux clients pour un total de ${total} FC`
    );
    if (!result) {
      return;
    }

    try {
      this.client.applicationFeePayments = {
        [this.time.todaysDate()]:
          Number(this.client.applicationFee) > 0
            ? `-${this.client.applicationFee}`
            : `${this.client.applicationFee}`,
      };

      this.client.membershipFeePayments = {
        [this.time.todaysDate()]:
          Number(this.client.membershipFee) > 0
            ? `-${this.client.membershipFee}`
            : `${this.client.membershipFee}`,
      };
      this.client.savingsPayments = {
        [this.time.todaysDate()]:
          Number(this.client.savings) > 0
            ? `-${this.client.savings}`
            : `${this.client.savings}`,
      };
      const updateUser =
        await this.data.UpdateUserInfoForCancelingdRegisteredClient(
          this.client
        );
      const clientCancel = await this.auth.cancelClientRegistration(
        this.client
      );

      // removed client from pending audit list.
      const removeFromPending = await this.removeClientFromPending();

      this.router.navigate(['/client-info-current/']);
    } catch (err) {
      console.log('error occured while cancelling registration', err);
      alert("Une erreur s'est de l'annulation de l'enregistrement, Réessayez");
      return;
    }
  }
  setGraphCredit() {
    let num = Number(this.client.creditScore);
    let gaugeColor = this.compute.getGradientColor(Number(num));

    this.graphCredit = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: {
            text: `Client Score Credit`,
          },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor }, // Color of the ticks (optional)
            bar: { color: gaugeColor }, // Single color for the gauge bar (needle)
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 }, // Adjust margins
        responsive: true, // Make the chart responsive
      },
    };
  }
  setGraphWorthiness() {
    let num = Number(this.client.creditworthinessScore);
    let gaugeColor = this.compute.getGradientColor(Number(num));
    let text = this.getCreditworthinessCategory(num);
    this.graphWorthiness = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: {
            text: text,
          },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor }, // Color of the ticks (optional)
            bar: { color: gaugeColor }, // Single color for the gauge bar (needle)
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 }, // Adjust margins
        responsive: true, // Make the chart responsive
      },
    };
  }
  async startUpload(event: FileList) {
    console.log('current employee', this.client);
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file?.type.split('/')[0] !== 'image') {
      console.log('unsupported file type');
      return;
    }
    // the size cannot be greater than 10mb
    if (file?.size >= 20000000) {
      alert(
        "L'image est trop grande. La Taille maximale du fichier est de 10MB"
      );
      return;
    }
    const path = `clients-avatar/${this.client.firstName}-${this.client.middleName}-${this.client.lastName}`;

    // the main task
    console.log('the path', path);

    // this.task = await this.storage.upload(path, file);
    const uploadTask = await this.storage.upload(path, file);
    this.url = await uploadTask.ref.getDownloadURL();
    uploadTask.totalBytes;
    // console.log('the download url', this.url);
    const avatar = {
      path: path,
      downloadURL: this.url,
      size: uploadTask.totalBytes.toString(),
    };
    try {
      await this.data.updateClientPictureData(this.client, avatar);
    } catch (error) {
      console.error('Error updating employee picture:', error);
    }
    // this.router.navigate(['/home']);
  }
  onImageClick(id: string): void {
    const fileInput = document.getElementById(id) as HTMLInputElement;
    fileInput.click();
  }
  getCreditworthinessCategory(score: number): string {
    if (score >= 90 && score <= 100) {
      return 'Excellent – Très solvable, faible risque.';
    } else if (score >= 70 && score <= 89) {
      return 'Bon – Solvable avec un risque modéré.';
    } else if (score >= 50 && score <= 69) {
      return 'Moyen – Risque potentiel.';
    } else if (score < 50) {
      return 'Faible – Risque élevé ; prêt non recommandé.';
    } else {
      return 'Score invalide.';
    }
  }

  async setClientField(field: string, value: any) {
    if (!this.compute.isNumber(value)) {
      alert('Enter a valid number');
      return;
    }
    try {
      const loA = await this.data.setClientField(
        field,
        value,
        this.client.uid!
      );
      alert('Montant changer avec succès');
    } catch (err) {
      alert("Une erreur s'est produite lors du placement du budget, Réessayez");
      return;
    }
  }
  async setClientFieldAgent(field: string, value: any) {
    if (!field || !String(value ?? '').trim()) {
      alert("Entrer un nom d'agent valide");
      return;
    }
    if (!this.client.uid || this.auditVerificationSaving) {
      return;
    }

    try {
      this.auditVerificationSaving = true;
      let audioFields: Partial<Client> = {};

      if (
        this.selectedAuditAudioFile &&
        !this.hasPersistedAuditConversationAudio
      ) {
        this.auditAudioUploading = true;
        audioFields = await this.uploadAuditConversationAudio(
          this.selectedAuditAudioFile
        );
      }

      await this.data.setClientFields(this.client.uid, {
        [field]: String(value).trim(),
        agentSubmittedVerification: 'true',
        ...audioFields,
      });

      this.client.agentVerifyingName = String(value).trim();
      this.client.agentSubmittedVerification = 'true';
      Object.assign(this.client, audioFields);
      this.agentSubmmittedVerification = 'true';
      this.agentVerifyingName = String(value).trim();
      alert('Confirmer avec succès');
      this.closeAuditConfirmation();
      this.clearSelectedAuditAudio();
      await this.removeClientFromPending();
    } catch (err) {
      console.error('Failed to confirm audit with optional audio:', err);
      alert("Une erreur s'est produite lors du placement du budget, Réessayez");
    } finally {
      this.auditAudioUploading = false;
      this.auditVerificationSaving = false;
    }
  }

  setFields() {
    if (this.client.savings) {
      this.savings = this.client.savings;
    }
    if (this.client.agentVerifyingName) {
      this.agentVerifyingName = this.client.agentVerifyingName!;
    }
    if (this.client.agentSubmittedVerification) {
      this.agentSubmmittedVerification =
        this.client.agentSubmittedVerification!;
    }
    if (this.client.dateJoined) {
      this.dateJoined = this.time.formatDateForDRC(this.client.dateJoined);
    }
  }
  // In your component (e.g., questions.component.ts):

  async removeClientFromPending(): Promise<void> {
    // 1) Find the audit that has this.client.uid in its pendingClients
    const matchingAudit = this.audits.find((audit) =>
      audit.pendingClients?.some((pc) => pc.clientId === this.client.uid)
    );

    if (!matchingAudit) {
      console.log('No matching audit found for this client.');
      return;
    }

    // 2) Call your DataService method to filter out this client
    try {
      await this.data.removePendingClientByFilter(
        matchingAudit,
        this.client.uid!
      );
      console.log('Client removed from pendingClients successfully!');

      // 3) Optionally remove the client locally for immediate UI feedback
      matchingAudit.pendingClients = matchingAudit.pendingClients?.filter(
        (pc) => pc.clientId !== this.client.uid
      );
    } catch (err) {
      console.error('Error removing client from pendingClients:', err);
    }
  }
  addComment() {
    if (this.comment === '' || this.personPostingComment === '') {
      alert('Remplissez toutes les données.');
      return;
    }
    let conf = confirm(`Êtes-vous sûr de vouloir publier ce commentaire`);
    if (!conf) {
      return;
    }
    try {
      const com = {
        name: this.personPostingComment,
        comment: this.comment,
        time: this.time.todaysDate(),
      };
      this.comments?.push(com);
      this.data
        .addCommentToClientProfile(this.client, this.comments)
        .then(() => {
          this.personPostingComment = '';
          this.comment = '';
        });
    } catch (error) {
      alert(
        "Une erreur s'est produite lors de la publication du commentaire. Essayer à nouveau."
      );
    }
  }

  requestCancel(c: Client) {
    const amount =
      Number(c.savings || 0) +
      Number(c.applicationFee || 0) +
      Number(c.membershipFee || 0);

    if (!amount) {
      alert('Aucun montant à rembourser');
      return;
    }

    if (
      !confirm(
        `Êtes-vous sûr de vouloir demander le remboursement des fonds avancés (dossier et épargne) au client, pour un montant total de ${amount.toLocaleString()} FC ?`
      )
    )
      return;

    const today = this.time.todaysDate(); // 05/28/2025
    const tomorrow = this.time.getTomorrowsDateMonthDayYear(); // 05/29/2025

    c.rejectionReturnAmount = amount.toString();
    c.requestAmount = c.rejectionReturnAmount;
    c.requestStatus = 'pending';
    c.requestType = 'rejection';
    c.requestDate = tomorrow;
    c.dateOfRequest = today;
    this.data
      .clientRequestRejectionRefund(c)
      .then(() => this.toast.success('Demande enregistrée 🚀'));
  }
  // ====== Ouvre la boîte de dialogue ======
  openRefundDialog() {
    this.selectedReturnDate = '';
    this.showRefundDialog = true;
  }

  // ====== Valide et enregistre la demande ======
  confirmRequestCancel(c: Client) {
    const amount =
      Number(c.savings || 0) +
      Number(c.applicationFee || 0) +
      Number(c.membershipFee || 0);

    if (!amount) {
      alert('Aucun montant à rembourser');
      return;
    }

    // Re‐formate la date ISO (yyyy-MM-dd) vers MM/dd/yyyy pour rester cohérent
    const [y, m, d] = this.selectedReturnDate.split('-');
    const formattedDate = `${parseInt(m, 10)}-${parseInt(d, 10)}-${y}`; // ex. 6/11/2025

    c.rejectionReturnAmount = amount.toString();
    c.previouslyRequestedAmount = c.requestAmount;
    // c.requestAmount = c.rejectionReturnAmount;
    c.requestStatus = 'pending';
    c.requestType = 'rejection';
    c.requestDate = formattedDate;
    c.dateOfRequest = this.time.todaysDate();

    this.data.clientRequestRejectionRefund(c).then(() => {
      alert('Demande enregistrée 🚀');
      // this.showRefundDialog = false;
      this.showRefundDialog = false;
    });
  }

  get allPhones(): string[] {
    // Current first, then previous; normalize + dedupe
    const raw = [
      this.client?.phoneNumber || '',
      ...(this.client?.previousPhoneNumbers || []),
    ].filter(Boolean);

    const norm = (x: string) => x.replace(/\D+/g, '');
    const out: string[] = [];
    for (const p of raw) {
      if (!out.some((q) => norm(q) === norm(p))) out.push(p);
    }
    return out;
  }

  togglePhoneHistory(): void {
    if (!this.allPhones.length) return;
    this.showPhoneHistory = !this.showPhoneHistory;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: Event) {
    if (!this.showPhoneHistory) return;
    const host = this.phoneHistoryRef?.nativeElement as HTMLElement | undefined;
    if (host && !host.contains(ev.target as Node))
      this.showPhoneHistory = false;
  }

  async copy(p: string) {
    try {
      await navigator.clipboard.writeText(p);
      this.copied = p;
      setTimeout(() => (this.copied = undefined), 1200);
    } catch {
      alert('Impossible de copier.');
    }
  }

  formatPhone(val?: string): string {
    const d = (val || '').replace(/\D+/g, '');
    if (!d) return '—';
    // (XXX) XXX-XXXX for 10 digits
    if (d.length === 10)
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
    // E.164-ish: split country / rest for 11–13 digits
    if (d.length >= 11 && d.length <= 13) {
      return `+${d.slice(0, d.length - 9)} ${d.slice(-9, -6)} ${d.slice(
        -6,
        -3
      )} ${d.slice(-3)}`;
    }
    // Fallback: group by 3s from the end
    return d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  onAuditAudioSelected(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    if (!this.isSupportedAudioFile(file)) {
      this.resetAuditConversationInputs();
      alert('Veuillez sélectionner un audio valide.');
      return;
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      this.resetAuditConversationInputs();
      alert("L'audio dépasse la limite de 20MB.");
      return;
    }

    const normalizedFile = this.normalizeAudioFile(file);
    this.clearSelectedAuditAudio();
    this.selectedAuditAudioFile = normalizedFile;
    this.selectedAuditAudioPreviewUrl = URL.createObjectURL(normalizedFile);
    this.resetAuditConversationInputs();
  }

  clearSelectedAuditAudio(): void {
    this.selectedAuditAudioFile = undefined;
    if (this.selectedAuditAudioPreviewUrl) {
      URL.revokeObjectURL(this.selectedAuditAudioPreviewUrl);
    }
    this.selectedAuditAudioPreviewUrl = undefined;
    this.resetAuditConversationInputs();
  }

  get hasPersistedAuditConversationAudio(): boolean {
    return !!this.client.auditConversationAudioUrl;
  }

  get auditConversationAudioUploadedAtFormatted(): string {
    const raw = this.client.auditConversationAudioUploadedAt;
    if (!raw) return '';
    return this.time.convertDateToDesiredFormat(raw);
  }

  get auditConversationAudioRecordedAtFormatted(): string {
    return this.formatISOToDRC(this.client.auditConversationAudioRecordedAt);
  }

  async saveAuditConversationAudioOnly(): Promise<void> {
    if (
      !this.client.uid ||
      !this.selectedAuditAudioFile ||
      this.auditAudioUploading ||
      this.auditVerificationSaving ||
      this.hasPersistedAuditConversationAudio
    ) {
      return;
    }

    try {
      this.auditAudioUploading = true;
      const audioFields = await this.uploadAuditConversationAudio(
        this.selectedAuditAudioFile
      );

      await this.data.setClientFields(this.client.uid, audioFields);
      Object.assign(this.client, audioFields);
      this.clearSelectedAuditAudio();
      this.showAuditConversation = true;
      alert('Audio joint avec succès');
    } catch (err) {
      console.error('Failed to attach audit audio without confirmation:', err);
      alert("Une erreur s'est produite lors de l'ajout de l'audio, Réessayez");
    } finally {
      this.auditAudioUploading = false;
    }
  }

  private async uploadAuditConversationAudio(
    file: File
  ): Promise<Partial<Client>> {
    const normalizedFile = this.normalizeAudioFile(file);
    const fileName = `${Date.now()}-${normalizedFile.name}`;
    const path = `audit-conversations/${this.client.uid}/${fileName}`;
    const mimeType =
      normalizedFile.type || this.inferAudioMimeType(normalizedFile) || 'audio/mp4';
    const recordedAt = this.detectAuditAudioRecordedAt(normalizedFile);
    const recordedAtSource = recordedAt ? 'fileLastModified' : 'uploadTime';

    const uploadTask = await this.storage.upload(path, normalizedFile, {
      customMetadata: {
        fileName: normalizedFile.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: this.auditActorName(),
        mimeType,
        recordedAt: recordedAt || '',
        recordedAtSource,
      },
      contentType: mimeType,
    });
    const url = await uploadTask.ref.getDownloadURL();

    return {
      auditConversationAudioUrl: url,
      auditConversationAudioName: normalizedFile.name,
      auditConversationAudioMimeType: mimeType,
      auditConversationAudioRecordedAt: recordedAt || undefined,
      auditConversationAudioRecordedAtSource: recordedAtSource,
      auditConversationAudioUploadedAt: this.time.todaysDate(),
      auditConversationAudioUploadedBy: this.auditActorName(),
    };
  }

  private auditActorName(): string {
    const firstName = this.auth.currentUser?.firstName || '';
    const lastName = this.auth.currentUser?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return (
      fullName ||
      this.agentVerifyingName ||
      this.auth.currentUser?.email ||
      'Audit'
    );
  }

  private isSupportedAudioFile(file: File): boolean {
    const mimeType = (file.type || '').toLowerCase();
    if (mimeType.startsWith('audio/')) return true;
    if (mimeType === 'video/3gpp' || mimeType === 'video/3gpp2') return true;

    const extension = this.fileExtension(file.name);
    return !!extension && this.supportedAudioExtensions.has(extension);
  }

  private normalizeAudioFile(file: File): File {
    const inferredMimeType = this.inferAudioMimeType(file);
    if (!inferredMimeType || file.type === inferredMimeType) {
      return file;
    }

    return new File([file], file.name, {
      type: inferredMimeType,
      lastModified: file.lastModified,
    });
  }

  private inferAudioMimeType(file: File): string {
    const mimeType = (file.type || '').toLowerCase();
    if (mimeType.startsWith('audio/')) return mimeType;

    switch (this.fileExtension(file.name)) {
      case 'm4a':
      case 'mp4':
        return 'audio/mp4';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'aac':
        return 'audio/aac';
      case 'caf':
        return 'audio/x-caf';
      case 'aif':
      case 'aiff':
        return 'audio/aiff';
      case 'amr':
        return 'audio/amr';
      case 'flac':
        return 'audio/flac';
      case 'ogg':
        return 'audio/ogg';
      case 'webm':
        return 'audio/webm';
      case '3gp':
      case '3gpp':
        return 'audio/3gpp';
      case '3gpp2':
        return 'audio/3gpp2';
      default:
        return mimeType;
    }
  }

  private fileExtension(fileName?: string): string {
    const normalized = (fileName || '').trim().toLowerCase();
    const lastDot = normalized.lastIndexOf('.');
    if (lastDot < 0 || lastDot === normalized.length - 1) return '';
    return normalized.slice(lastDot + 1);
  }

  private detectAuditAudioRecordedAt(file: File): string | undefined {
    if (!file.lastModified) return undefined;

    const recordedAt = new Date(file.lastModified);
    if (Number.isNaN(recordedAt.getTime())) {
      return undefined;
    }

    return recordedAt.toISOString();
  }

  private formatISOToDRC(iso?: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const fmt = new Intl.DateTimeFormat('fr-CD', {
        timeZone: 'Africa/Kinshasa',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = fmt.formatToParts(d).reduce((acc: any, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});
      return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
    } catch {
      return iso;
    }
  }

  private resetAuditConversationInputs(): void {
    this.resetFileInput(this.auditConversationInlineInputId);
    this.resetFileInput(this.auditConversationModalInputId);
  }

  private resetFileInput(inputId: string): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }
}
