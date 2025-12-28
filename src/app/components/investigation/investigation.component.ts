import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from 'src/app/models/user';
import { Client, Comment } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

type InvestigationDayComment = {
  name?: string;
  comment?: string;
  time?: string;
  timeFormatted?: string;
};

type InvestigationDayDoc = {
  dateKey?: string;
  summary?: string;
  comments?: InvestigationDayComment[];
  updatedAt?: string;
};

type TFEntry = { loc: string; employees: string[] };
type TFCell = { iso: string; entries?: TFEntry[] };

@Component({
  selector: 'app-investigation',
  templateUrl: './investigation.component.html',
  styleUrls: ['./investigation.component.css'],
})
export class InvestigationComponent implements OnInit, OnDestroy {
  clients: Client[] = [];
  allClients: Client[] = [];
  shouldPayToday: Client[] = [];
  problematicClients: Client[] = [];
  locations: User[] = [];
  selectedLocationId = '';
  selectedLocationLabel = '';
  private currentUserId = '';

  activeClient?: Client;
  showClientModal = false;
  clientCommentName = '';
  clientCommentText = '';
  selectedCommentImageFile?: File;
  selectedCommentImagePreview?: string;
  selectedCommentVideoFile?: File;
  selectedCommentVideoPreview?: string;
  selectedCommentAudioFile?: File;
  selectedCommentAudioPreview?: string;
  commentImageUploadUrl = '';
  commentVideoUploadUrl = '';
  commentAudioUploadUrl = '';
  commentMediaUploading = false;

  dayKey = '';
  dayLabel = '';
  selectedDate = '';
  daySummary = '';
  daySummarySaving = false;
  dayComments: InvestigationDayComment[] = [];
  dayCommentName = '';
  dayCommentText = '';
  dayCommentPosting = false;
  showAllDayComments = false;

  employees: Employee[] = [];
  taskForceLocations: string[] = [];
  taskMonthWeeks: (TFCell | null)[][] = [];
  taskWeekSummary: { day: string; entries: TFEntry[] }[] = [];
  taskPicker = {
    visible: false,
    day: null as null | { iso: string; date: Date },
    entries: [] as { loc: string; employees: string[] }[],
    newLoc: '',
    search: '',
    selected: new Set<string>(),
  };

  readonly weekHeaders = [
    'Dimanche',
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
  ];
  readonly monthNames: string[] = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ];
  month = new Date().getMonth() + 1;
  year = new Date().getFullYear();

  private dayDoc?: AngularFirestoreDocument<InvestigationDayDoc>;
  private subs = new Subscription();
  private dayDocSub?: Subscription;
  private clientsSub?: Subscription;
  private allClientsSub = new Subscription();
  private allEmployeesSub = new Subscription();
  private tfSubs: Subscription[] = [];
  private tfCellByIso = new Map<string, TFCell>();

  constructor(
    public auth: AuthService,
    private time: TimeService,
    private data: DataService,
    private performance: PerformanceService,
    private afs: AngularFirestore,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.isAdmin && !this.auth.isInvestigator) {
      this.router.navigate(['/home']);
      return;
    }
    this.selectedDate = this.time.getTodaysDateYearMonthDay();
    this.updateDateContext();

    const userSub = this.auth.user$.subscribe((user: User | null) => {
      this.currentUserId = user?.uid ?? '';
      this.ensureDefaultLocation();
    });
    const locationsSub = this.auth.getAllUsersInfo().subscribe((data) => {
      this.locations = Array.isArray(data) ? (data as User[]) : [];
      this.ensureDefaultLocation();
      this.updateTaskForceLocations();
      this.loadAllEmployeesForLocations();
      this.loadAllProblematicClients();
    });

    this.subs.add(userSub);
    this.subs.add(locationsSub);

    this.loadTaskForceMonth();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.tfSubs.forEach((s) => s.unsubscribe());
  }

  private loadClientsForLocation(userId: string): void {
    if (this.clientsSub) {
      this.clientsSub.unsubscribe();
    }
    this.clientsSub = this.auth.getClientsOfAUser(userId).subscribe((data) => {
      const base = Array.isArray(data) ? (data.filter(Boolean) as Client[]) : [];
      this.clients = base.map((client) => ({
        ...client,
        locationName: this.selectedLocationLabel,
        locationOwnerId: userId,
      }));
      this.assignTrackingIds();
      this.filterShouldPayToday();
    });
    this.subs.add(this.clientsSub);
  }

  private loadAllProblematicClients(): void {
    this.allClientsSub.unsubscribe();
    this.allClientsSub = new Subscription();

    if (!this.locations.length) {
      this.allClients = [];
      this.refreshProblematic();
      return;
    }

    let tempClients: Client[] = [];
    let completedRequests = 0;
    const total = this.locations.length;

    this.locations.forEach((loc) => {
      if (!loc?.uid) {
        completedRequests++;
        return;
      }
      const sub = this.auth.getClientsOfAUser(loc.uid).subscribe((clients) => {
        const tagged = Array.isArray(clients)
          ? clients.map((c) => ({
              ...c,
              locationName: loc.firstName || loc.email || 'Site',
              locationOwnerId: loc.uid,
            }))
          : [];
        tempClients = tempClients.concat(tagged);
        completedRequests++;
        if (completedRequests === total) {
          this.allClients = tempClients.filter(Boolean) as Client[];
          this.refreshProblematic();
        }
      });
      this.allClientsSub.add(sub);
    });

    this.subs.add(this.allClientsSub);
  }

  private initDayDocForLocation(userId: string): void {
    this.dayDoc = this.getDayDocRef(userId);

    if (this.dayDocSub) {
      this.dayDocSub.unsubscribe();
    }

    this.dayDocSub = this.dayDoc.valueChanges().subscribe((doc) => {
      this.daySummary = doc?.summary ?? '';
      this.dayComments = Array.isArray(doc?.comments) ? doc!.comments! : [];
      this.dayComments = this.sortDayComments(this.dayComments);
    });

    this.subs.add(this.dayDocSub);
  }

  private getDayDocRef(userId?: string) {
    const ownerId = userId || this.selectedLocationId || this.currentUserId;
    return this.afs.doc<InvestigationDayDoc>(
      `users/${ownerId}/investigationDays/${this.dayKey}`
    );
  }

  private ensureDefaultLocation(): void {
    if (this.selectedLocationId) return;
    const preferred = this.currentUserId || this.locations[0]?.uid || '';
    if (!preferred) return;
    const user =
      this.locations.find((loc) => loc.uid === preferred) ||
      ({ uid: preferred } as User);
    this.applyLocation(user);
  }

  private applyLocation(user: User): void {
    if (!user?.uid) return;
    this.selectedLocationId = user.uid;
    this.selectedLocationLabel = user.firstName || user.email || 'Site';
    this.daySummary = '';
    this.dayComments = [];
    this.loadClientsForLocation(user.uid);
    this.initDayDocForLocation(user.uid);
  }

  private updateTaskForceLocations(): void {
    const names = (this.locations || [])
      .map((loc) => (loc.firstName || loc.email || 'Site').trim())
      .filter((name) => name.length > 0);
    this.taskForceLocations = Array.from(new Set(names));
  }

  private loadAllEmployeesForLocations(): void {
    this.allEmployeesSub.unsubscribe();
    this.allEmployeesSub = new Subscription();

    const sources = this.locations
      .filter((loc) => !!loc?.uid)
      .map((loc) =>
        this.auth.getAllEmployeesGivenUser(loc).pipe(
          map((data: any) =>
            Array.isArray(data) ? (data.filter(Boolean) as Employee[]) : []
          )
        )
      );

    if (sources.length === 0) {
      this.employees = [];
      return;
    }

    const sub = combineLatest(sources).subscribe((lists) => {
      const merged = lists.flat();
      const deduped = new Map<string, Employee>();

      merged.forEach((emp) => {
        if (emp?.uid) {
          deduped.set(emp.uid, emp);
        }
      });

      this.employees = Array.from(deduped.values());
    });

    this.allEmployeesSub.add(sub);
    this.subs.add(this.allEmployeesSub);
  }

  onLocationChange(): void {
    const user = this.locations.find(
      (loc) => loc.uid === this.selectedLocationId
    );
    if (!user) return;
    this.applyLocation(user);
  }

  private assignTrackingIds(): void {
    this.clients.forEach((client, index) => {
      client.trackingId = `${index}`;
    });
  }

  private filterShouldPayToday(): void {
    const dayName = this.time.getDayOfWeek(this.dayKey);
    this.shouldPayToday = this.clients.filter(
      (client) => {
        const isAlive =
          !client.vitalStatus || client.vitalStatus.toLowerCase() === 'vivant';
        const hasDebt = Number(client.debtLeft ?? 0) > 0;
        return client.paymentDay === dayName && isAlive && hasDebt;
      }
    );
  }

  private updateDateContext(): void {
    if (this.selectedDate) {
      this.dayKey = this.time.convertDateToMonthDayYear(this.selectedDate);
    } else {
      this.dayKey = this.time.todaysDateMonthDayYear();
    }

    const dayName = this.time.getDayOfWeek(this.dayKey);
    const dayFrench = this.time.englishToFrenchDay[dayName] ?? dayName;
    this.dayLabel = `${dayFrench} ${this.time.convertDateToDayMonthYear(
      this.dayKey
    )}`;
  }

  onDateChange(): void {
    this.updateDateContext();
    this.filterShouldPayToday();
    const ownerId = this.selectedLocationId || this.currentUserId;
    if (ownerId) {
      this.daySummary = '';
      this.dayComments = [];
      this.initDayDocForLocation(ownerId);
    }
  }

  private refreshProblematic(): void {
    this.problematicClients = this.allClients.filter((client) =>
      this.isProblematic(client)
    );
  }

  isProblematic(client: Client): boolean {
    const debt = Number(client.debtLeft ?? 0);
    const recognizedRaw = client.debtRecognized ?? '';
    if (debt <= 0) return false;
    if (recognizedRaw === '') return false;
    const recognized = Number(recognizedRaw);
    if (Number.isNaN(recognized)) return false;
    return recognized !== debt;
  }

  formatAmount(value?: string | number): string {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  }

  displayPhone(value?: string): string {
    const raw = (value ?? '').toString().trim();
    return raw.length ? raw : 'numero indisponible';
  }

  displayPaymentDay(day?: string): string {
    const raw = (day ?? '').toString().trim();
    if (!raw) return '-';
    return this.time.englishToFrenchDay[raw] ?? raw;
  }

  clientInitials(client: Client): string {
    const first = (client.firstName ?? '').trim();
    const last = (client.lastName ?? '').trim();
    const a = first ? first[0] : '';
    const b = last ? last[0] : '';
    return (a + b || '•').toUpperCase();
  }

  getInvestigationComments(client: Client): Comment[] {
    const comments = Array.isArray(client.comments) ? client.comments : [];
    const filtered = comments.filter(
      (comment) => comment && comment.source === 'investigation'
    );
    return this.sortClientComments(filtered);
  }

  latestInvestigationComment(client: Client): Comment | null {
    const list = this.getInvestigationComments(client);
    return list.length ? list[0] : null;
  }

  commentTime(comment: Comment | InvestigationDayComment): string {
    if (comment.timeFormatted) return comment.timeFormatted;
    if (!comment.time) return '';
    return this.time.convertDateToDesiredFormat(comment.time);
  }

  saveDebtRecognized(client: Client): void {
    if (!client?.uid) return;
    const debtRecognized = client.debtRecognized ?? '';
    const ownerId =
      client.locationOwnerId ||
      this.selectedLocationId ||
      this.currentUserId;
    const update = ownerId
      ? this.data.updateClientInvestigationFieldsForUser(
          ownerId,
          client.uid,
          { debtRecognized }
        )
      : this.data.updateClientInvestigationFields(client.uid, {
          debtRecognized,
        });

    update
      .then(() => {
        this.applyDebtRecognizedLocal(client.uid!, debtRecognized, ownerId);
        this.refreshProblematic();
      })
      .catch((err) => {
        console.error('Failed to update debtRecognized:', err);
        alert('Impossible de sauvegarder la dette reconnue.');
      });
  }

  private applyDebtRecognizedLocal(
    clientId: string,
    debtRecognized: string,
    ownerId: string
  ): void {
    const updateList = (list: Client[]) => {
      list.forEach((c) => {
        if (
          c.uid === clientId &&
          (c.locationOwnerId ? c.locationOwnerId === ownerId : true)
        ) {
          c.debtRecognized = debtRecognized;
        }
      });
    };

    updateList(this.clients);
    updateList(this.allClients);
  }

  openClientModal(client: Client): void {
    this.activeClient = client;
    this.clientCommentName = '';
    this.clientCommentText = '';
    this.showClientModal = true;
  }

  closeClientModal(): void {
    this.showClientModal = false;
    this.activeClient = undefined;
  }

  postClientComment(): void {
    if (!this.activeClient?.uid) return;
    if (!this.clientCommentName.trim()) {
      alert('Veuillez saisir votre nom.');
      return;
    }

    const hasText = this.clientCommentText.trim().length > 0;
    const hasImage = !!this.selectedCommentImageFile;
    const hasVideo = !!this.selectedCommentVideoFile;
    const hasAudio = !!this.selectedCommentAudioFile;
    if (!hasText && !hasImage && !hasVideo && !hasAudio) {
      alert('Veuillez saisir un commentaire ou joindre un média.');
      return;
    }

    if (hasImage || hasVideo || hasAudio) {
      this.uploadCommentMediaAndPost();
    } else {
      this.finalizeClientCommentPost();
    }
  }

  onCommentImageSelected(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image.');
      return;
    }
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("L'image dépasse la limite de 20MB.");
      return;
    }
    this.selectedCommentImageFile = file;
    this.selectedCommentImagePreview = URL.createObjectURL(file);
  }

  onCommentVideoSelected(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith('video/')) {
      alert('Veuillez sélectionner une vidéo.');
      return;
    }
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('La vidéo dépasse la limite de 20MB.');
      return;
    }
    this.selectedCommentVideoFile = file;
    this.selectedCommentVideoPreview = URL.createObjectURL(file);
  }

  onCommentAudioSelected(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith('audio/')) {
      alert('Veuillez sélectionner un audio.');
      return;
    }
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("L'audio dépasse la limite de 20MB.");
      return;
    }
    this.selectedCommentAudioFile = file;
    this.selectedCommentAudioPreview = URL.createObjectURL(file);
  }

  clearCommentImage(): void {
    this.selectedCommentImageFile = undefined;
    if (this.selectedCommentImagePreview) {
      URL.revokeObjectURL(this.selectedCommentImagePreview);
    }
    this.selectedCommentImagePreview = undefined;
  }

  clearCommentVideo(): void {
    this.selectedCommentVideoFile = undefined;
    if (this.selectedCommentVideoPreview) {
      URL.revokeObjectURL(this.selectedCommentVideoPreview);
    }
    this.selectedCommentVideoPreview = undefined;
  }

  clearCommentAudio(): void {
    this.selectedCommentAudioFile = undefined;
    if (this.selectedCommentAudioPreview) {
      URL.revokeObjectURL(this.selectedCommentAudioPreview);
    }
    this.selectedCommentAudioPreview = undefined;
  }

  private uploadCommentMediaAndPost(): void {
    if (!this.activeClient?.uid) return;
    if (this.commentMediaUploading) return;

    const ownerId =
      this.activeClient.locationOwnerId ||
      this.selectedLocationId ||
      this.currentUserId;
    const userId = ownerId || this.currentUserId;
    const time = this.time.todaysDate();

    this.commentMediaUploading = true;

    const jobs: Promise<void>[] = [];
    if (this.selectedCommentImageFile) {
      const file = this.selectedCommentImageFile;
      const path = `comment-images/${userId}/${this.activeClient.uid}/${time}-${file.name}`;
      jobs.push(
        this.data.uploadCommentFile(file, path).then((url) => {
          this.commentImageUploadUrl = url;
        })
      );
    }
    if (this.selectedCommentVideoFile) {
      const file = this.selectedCommentVideoFile;
      const path = `comment-videos/${userId}/${this.activeClient.uid}/${time}-${file.name}`;
      jobs.push(
        this.data.uploadCommentFile(file, path).then((url) => {
          this.commentVideoUploadUrl = url;
        })
      );
    }
    if (this.selectedCommentAudioFile) {
      const file = this.selectedCommentAudioFile;
      const path = `comment-audios/${userId}/${this.activeClient.uid}/${time}-${file.name}`;
      jobs.push(
        this.data.uploadCommentFile(file, path).then((url) => {
          this.commentAudioUploadUrl = url;
        })
      );
    }

    Promise.all(jobs)
      .then(() => {
        this.finalizeClientCommentPost();
      })
      .catch((err) => {
        console.error('Failed to upload comment media:', err);
        alert("Impossible d'envoyer le média.");
      })
      .finally(() => {
        this.commentMediaUploading = false;
      });
  }

  private finalizeClientCommentPost(): void {
    if (!this.activeClient?.uid) return;

    const time = this.time.todaysDate();
    const commentText = this.clientCommentText.trim();
    const attachments = [];
    if (this.commentImageUploadUrl) {
      attachments.push({
        type: 'image' as const,
        url: this.commentImageUploadUrl,
        mimeType: this.selectedCommentImageFile?.type || 'image/jpeg',
        size: this.selectedCommentImageFile?.size || 0,
      });
    }
    if (this.commentVideoUploadUrl) {
      attachments.push({
        type: 'video' as const,
        url: this.commentVideoUploadUrl,
        mimeType: this.selectedCommentVideoFile?.type || 'video/mp4',
        size: this.selectedCommentVideoFile?.size || 0,
      });
    }

    const newComment: Comment = {
      name: this.clientCommentName.trim(),
      comment: commentText,
      time,
      timeFormatted: this.time.convertDateToDesiredFormat(time),
      source: 'investigation',
      ...(attachments.length ? { attachments } : {}),
      ...(this.commentAudioUploadUrl
        ? { audioUrl: this.commentAudioUploadUrl }
        : {}),
    };

    const existing = Array.isArray(this.activeClient.comments)
      ? this.activeClient.comments
      : [];
    const updated = [...existing, newComment];

    const ownerId =
      this.activeClient.locationOwnerId ||
      this.selectedLocationId ||
      this.currentUserId;

    const save = ownerId
      ? this.data.addCommentToClientProfileForUser(
          ownerId,
          this.activeClient,
          updated
        )
      : this.data.addCommentToClientProfile(this.activeClient, updated);

    save
      .then(() => {
        this.activeClient!.comments = updated;
        this.clientCommentText = '';
        this.commentImageUploadUrl = '';
        this.commentVideoUploadUrl = '';
        this.commentAudioUploadUrl = '';
        this.clearCommentImage();
        this.clearCommentVideo();
        this.clearCommentAudio();
        this.refreshProblematic();
      })
      .catch((err) => {
        console.error('Failed to add investigation comment:', err);
        alert('Impossible de publier le commentaire.');
      });
  }

  saveDaySummary(): void {
    if (!this.dayDoc) return;
    this.daySummarySaving = true;

    const payload: InvestigationDayDoc = {
      dateKey: this.dayKey,
      summary: this.daySummary.trim(),
      updatedAt: this.time.todaysDate(),
    };

    this.dayDoc
      .set(payload, { merge: true })
      .catch((err) => {
        console.error('Failed to save day summary:', err);
        alert('Impossible de sauvegarder le resume.');
      })
      .finally(() => {
        this.daySummarySaving = false;
      });
  }

  postDayComment(): void {
    if (!this.selectedLocationId && !this.currentUserId) {
      alert('Utilisateur non disponible. Veuillez reessayer.');
      return;
    }
    if (!this.dayCommentName.trim() || !this.dayCommentText.trim()) {
      alert('Veuillez saisir votre nom et un commentaire.');
      return;
    }
    if (this.dayCommentPosting) return;

    const time = this.time.todaysDate();
    const newComment: InvestigationDayComment = {
      name: this.dayCommentName.trim(),
      comment: this.dayCommentText.trim(),
      time,
      timeFormatted: this.time.convertDateToDesiredFormat(time),
    };

    const updated = [...this.dayComments, newComment];
    this.dayComments = this.sortDayComments(updated);

    const dayDoc = this.getDayDocRef();
    this.dayCommentPosting = true;
    dayDoc
      .set(
        {
          dateKey: this.dayKey,
          comments: this.dayComments,
          updatedAt: time,
        },
        { merge: true }
      )
      .then(() => {
        this.dayCommentName = '';
        this.dayCommentText = '';
      })
      .catch((err) => {
        console.error('Failed to post day comment:', err);
        alert('Impossible de publier le commentaire.');
      })
      .finally(() => {
        this.dayCommentPosting = false;
      });
  }

  deleteDayComment(index: number): void {
    if (!this.auth.isAdmin) return;
    if (!this.selectedLocationId && !this.currentUserId) return;
    if (index < 0 || index >= this.dayComments.length) return;

    if (!confirm('Supprimer définitivement ce commentaire ?')) return;

    const updated = [...this.dayComments];
    updated.splice(index, 1);
    this.dayComments = this.sortDayComments(updated);

    const dayDoc = this.getDayDocRef();
    dayDoc
      .set({ comments: this.dayComments }, { merge: true })
      .catch((err) => {
        console.error('Failed to delete day comment:', err);
        alert('Impossible de supprimer le commentaire.');
      });
  }

  private sortClientComments(comments: Comment[]): Comment[] {
    return [...comments].sort((a: any, b: any) => {
      const dateA = this.time.parseFlexibleDateTime(a.time ?? '').getTime();
      const dateB = this.time.parseFlexibleDateTime(b.time ?? '').getTime();
      return dateB - dateA;
    });
  }

  private sortDayComments(
    comments: InvestigationDayComment[]
  ): InvestigationDayComment[] {
    return [...comments].sort((a, b) => {
      const dateA = this.time.parseFlexibleDateTime(a.time ?? '').getTime();
      const dateB = this.time.parseFlexibleDateTime(b.time ?? '').getTime();
      return dateB - dateA;
    });
  }

  private loadTaskForceMonth(): void {
    this.tfSubs.forEach((s) => s.unsubscribe());
    this.tfSubs = [];
    this.tfCellByIso.clear();

    const first = this.startOfMonth(new Date(this.year, this.month - 1));
    const last = this.endOfMonth(first);
    const weeks: typeof this.taskMonthWeeks = [];
    let row = new Array(7).fill(null);

    for (let d = first; d <= last; d = this.addDays(d, 1)) {
      const iso = this.ymd(d);
      row[d.getDay()] = { iso };
      if (d.getDay() === 6) {
        weeks.push(row);
        row = new Array(7).fill(null);
      }
    }
    if (row.some((c) => c)) weeks.push(row);

    for (const r of weeks) {
      for (const c of r) {
        if (c) this.tfCellByIso.set(c.iso, c);
      }
    }

    this.taskMonthWeeks = weeks;

    const ids = new Set<string>();
    for (let d = first; d <= last; d = this.addDays(d, 7)) {
      ids.add(this.isoWeekId(d));
    }

    ids.forEach((id) => {
      const sub = this.performance.getTaskForce(id).subscribe((doc) => {
        const days = doc?.days ?? {};

        for (const [iso, cell] of this.tfCellByIso) {
          if (this.isoWeekId(this.isoToLocal(iso)) === id) {
            cell.entries = [];
          }
        }

        Object.entries(days).forEach(([iso, val]) => {
          const cell = this.tfCellByIso.get(iso);
          if (!cell) return;

          const dayMap =
            typeof val === 'string'
              ? { [val.toLowerCase()]: { loc: val, employees: [] } }
              : (val as Record<string, { loc: string; employees: string[] }>);

          cell.entries = Object.values(dayMap).map((d) => ({
            loc: d.loc,
            employees: Array.isArray(d.employees) ? d.employees : [],
          }));
        });

        this.recomputeTaskWeekSummary();
      });

      this.tfSubs.push(sub);
    });
  }

  private recomputeTaskWeekSummary(): void {
    const base = this.startOfWeek(new Date());
    const names = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];

    this.taskWeekSummary = Array.from({ length: 7 }).map((_, i) => {
      const d = this.addDays(base, i);
      const iso = this.ymd(d);

      let entries: TFEntry[] = [];
      for (const row of this.taskMonthWeeks) {
        for (const c of row) {
          if (c && c.iso === iso) entries = c.entries ?? [];
        }
      }

      return { day: names[i], entries };
    });
  }

  get tfCanEdit(): boolean {
    return this.auth.isAdmin;
  }

  openTFPicker(cell: { iso: string }): void {
    if (!this.tfCanEdit) return;

    const dateObj = this.isoToLocal(cell.iso);
    let entries: TFEntry[] = [];
    for (const row of this.taskMonthWeeks) {
      for (const c of row) {
        if (c && c.iso === cell.iso) entries = c.entries ?? [];
      }
    }

    this.taskPicker = {
      visible: true,
      day: { iso: cell.iso, date: dateObj },
      entries: entries.map((e) => ({
        loc: e.loc,
        employees: [...(e.employees || [])],
      })),
      newLoc: '',
      search: '',
      selected: new Set<string>(),
    };
  }

  closeTFPicker(): void {
    this.taskPicker.visible = false;
  }

  byUid(uid?: string): Employee | undefined {
    return this.employees.find((e) => e.uid === uid);
  }

  filteredEmployees(): Employee[] {
    const needle = this.taskPicker.search.trim().toLowerCase();
    return this.employees.filter((e) => {
      if (!e.uid) return false;
      if (!needle) return true;
      const full = `${e.firstName ?? ''} ${e.lastName ?? ''}`.toLowerCase();
      return full.includes(needle);
    });
  }

  toggleSelect(uid: string): void {
    if (this.taskPicker.selected.has(uid)) {
      this.taskPicker.selected.delete(uid);
    } else {
      this.taskPicker.selected.add(uid);
    }
  }

  addSelectedToLocation(targetLoc: string): void {
    const loc = (targetLoc || '').trim();
    if (!loc || this.taskPicker.selected.size === 0) return;

    const found = this.taskPicker.entries.find(
      (e) => e.loc.toLowerCase() === loc.toLowerCase()
    );
    const toAdd = Array.from(this.taskPicker.selected);

    if (found) {
      const set = new Set(found.employees);
      toAdd.forEach((u) => set.add(u));
      found.employees = Array.from(set);
    } else {
      this.taskPicker.entries.push({ loc, employees: toAdd });
    }

    this.taskPicker.newLoc = '';
    this.taskPicker.selected.clear();
    this.taskPicker.search = '';
  }

  removeUidFromLoc(loc: string, uid: string): void {
    const e = this.taskPicker.entries.find((x) => x.loc === loc);
    if (!e || !this.taskPicker.day) return;

    e.employees = e.employees.filter((u) => u !== uid);
    const weekId = this.isoWeekId(this.taskPicker.day.date);
    this.performance.removeTFPerson(weekId, this.taskPicker.day.iso, loc, uid);

    if (e.employees.length === 0) {
      this.taskPicker.entries = this.taskPicker.entries.filter(
        (x) => x.loc !== loc
      );
      this.performance.clearTFLocation(weekId, this.taskPicker.day.iso, loc);
    }
  }

  removeLocation(loc: string): void {
    if (!this.taskPicker.day) return;

    this.taskPicker.entries = this.taskPicker.entries.filter(
      (e) => e.loc !== loc
    );

    const weekId = this.isoWeekId(this.taskPicker.day.date);
    this.performance.clearTFLocation(weekId, this.taskPicker.day.iso, loc);
  }

  async saveTF(): Promise<void> {
    if (!this.taskPicker.day) return;

    const iso = this.taskPicker.day.iso;
    const weekId = this.isoWeekId(this.taskPicker.day.date);

    const map: { [k: string]: { loc: string; employees: string[] } } = {};
    for (const e of this.taskPicker.entries) {
      const key = e.loc
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      map[key] = { loc: e.loc, employees: e.employees };
    }

    await this.performance.setTaskForceDay(
      weekId,
      iso,
      Object.keys(map).length ? map : null
    );

    this.closeTFPicker();
    this.loadTaskForceMonth();
  }

  private getISOWeek(d: Date): number {
    const t = new Date(d.getTime());
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const week1 = new Date(t.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((t.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    );
  }

  private isoWeekId(d: Date): string {
    return `${d.getFullYear()}-W${this.getISOWeek(d)
      .toString()
      .padStart(2, '0')}`;
  }

  private startOfWeek(d: Date): Date {
    const s = new Date(d);
    s.setDate(s.getDate() - s.getDay());
    s.setHours(0, 0, 0, 0);
    return s;
  }

  private isoToLocal(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  private startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private endOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  prevTaskForceMonth(): void {
    const d = new Date(this.year, this.month - 1, 1);
    d.setMonth(d.getMonth() - 1);
    this.month = d.getMonth() + 1;
    this.year = d.getFullYear();
    this.loadTaskForceMonth();
  }

  nextTaskForceMonth(): void {
    const d = new Date(this.year, this.month - 1, 1);
    d.setMonth(d.getMonth() + 1);
    this.month = d.getMonth() + 1;
    this.year = d.getFullYear();
    this.loadTaskForceMonth();
  }

  private ymd(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
