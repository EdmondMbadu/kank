import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';
import { User } from 'src/app/models/user';
import { Client, Comment } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
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

  dayKey = '';
  dayLabel = '';
  daySummary = '';
  daySummarySaving = false;
  dayComments: InvestigationDayComment[] = [];
  dayCommentName = '';
  dayCommentText = '';
  dayCommentPosting = false;
  showAllDayComments = false;

  private dayDoc?: AngularFirestoreDocument<InvestigationDayDoc>;
  private subs = new Subscription();
  private dayDocSub?: Subscription;
  private clientsSub?: Subscription;
  private allClientsSub = new Subscription();

  constructor(
    public auth: AuthService,
    private time: TimeService,
    private data: DataService,
    private afs: AngularFirestore
  ) {}

  ngOnInit(): void {
    this.dayKey = this.time.todaysDateMonthDayYear();
    const dayName = this.time.getDayOfWeek(this.dayKey);
    const dayFrench = this.time.englishToFrenchDay[dayName] ?? dayName;
    this.dayLabel = `${dayFrench} ${this.time.convertDateToDayMonthYear(
      this.dayKey
    )}`;

    const userSub = this.auth.user$.subscribe((user: User | null) => {
      this.currentUserId = user?.uid ?? '';
      this.ensureDefaultLocation();
    });
    const locationsSub = this.auth.getAllUsersInfo().subscribe((data) => {
      this.locations = Array.isArray(data) ? (data as User[]) : [];
      this.ensureDefaultLocation();
      this.loadAllProblematicClients();
    });

    this.subs.add(userSub);
    this.subs.add(locationsSub);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
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
    const todayKey = this.time.todaysDateMonthDayYear();
    const dayName = this.time.getDayOfWeek(todayKey);
    this.shouldPayToday = this.clients.filter(
      (client) => {
        const isAlive =
          !client.vitalStatus || client.vitalStatus.toLowerCase() === 'vivant';
        const hasDebt = Number(client.debtLeft ?? 0) > 0;
        return client.paymentDay === dayName && isAlive && hasDebt;
      }
    );
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
    if (!this.clientCommentName.trim() || !this.clientCommentText.trim()) {
      alert('Veuillez saisir votre nom et un commentaire.');
      return;
    }

    const time = this.time.todaysDate();
    const newComment: Comment = {
      name: this.clientCommentName.trim(),
      comment: this.clientCommentText.trim(),
      time,
      timeFormatted: this.time.convertDateToDesiredFormat(time),
      source: 'investigation',
    };

    const existing = Array.isArray(this.activeClient.comments)
      ? this.activeClient.comments
      : [];
    const updated = [...existing, newComment];

    this.data
      .addCommentToClientProfile(this.activeClient, updated)
      .then(() => {
        this.activeClient!.comments = updated;
        this.clientCommentText = '';
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
}
