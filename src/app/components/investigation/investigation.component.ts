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
  shouldPayToday: Client[] = [];
  problematicClients: Client[] = [];

  activeClient?: Client;
  showClientModal = false;
  clientCommentName = '';
  clientCommentText = '';

  dayKey = '';
  daySummary = '';
  daySummarySaving = false;
  dayComments: InvestigationDayComment[] = [];
  dayCommentName = '';
  dayCommentText = '';
  showAllDayComments = false;

  private dayDoc?: AngularFirestoreDocument<InvestigationDayDoc>;
  private subs = new Subscription();
  private dayDocSub?: Subscription;

  constructor(
    public auth: AuthService,
    private time: TimeService,
    private data: DataService,
    private afs: AngularFirestore
  ) {}

  ngOnInit(): void {
    this.dayKey = this.time.todaysDateMonthDayYear();
    this.loadClients();
    this.initDayDoc();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private loadClients(): void {
    const sub = this.auth.getAllClients().subscribe((data: any) => {
      this.clients = Array.isArray(data) ? (data.filter(Boolean) as Client[]) : [];
      this.assignTrackingIds();
      this.filterShouldPayToday();
      this.refreshProblematic();
    });
    this.subs.add(sub);
  }

  private initDayDoc(): void {
    const sub = this.auth.user$.subscribe((user: User | null) => {
      if (!user?.uid) return;

      this.dayDoc = this.afs.doc<InvestigationDayDoc>(
        `users/${user.uid}/investigationDays/${this.dayKey}`
      );

      if (this.dayDocSub) {
        this.dayDocSub.unsubscribe();
      }

      this.dayDocSub = this.dayDoc.valueChanges().subscribe((doc) => {
        this.daySummary = doc?.summary ?? '';
        this.dayComments = Array.isArray(doc?.comments) ? doc!.comments! : [];
        this.dayComments = this.sortDayComments(this.dayComments);
      });

      this.subs.add(this.dayDocSub);
    });

    this.subs.add(sub);
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
      (client) => client.paymentDay === dayName
    );
  }

  private refreshProblematic(): void {
    this.problematicClients = this.clients.filter((client) =>
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
    this.data
      .updateClientInvestigationFields(client.uid, { debtRecognized })
      .then(() => {
        this.refreshProblematic();
      })
      .catch((err) => {
        console.error('Failed to update debtRecognized:', err);
        alert('Impossible de sauvegarder la dette reconnue.');
      });
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
    if (!this.dayDoc) {
      alert('Utilisateur non disponible. Veuillez reessayer.');
      return;
    }
    if (!this.dayCommentName.trim() || !this.dayCommentText.trim()) {
      alert('Veuillez saisir votre nom et un commentaire.');
      return;
    }

    const time = this.time.todaysDate();
    const newComment: InvestigationDayComment = {
      name: this.dayCommentName.trim(),
      comment: this.dayCommentText.trim(),
      time,
      timeFormatted: this.time.convertDateToDesiredFormat(time),
    };

    const updated = [...this.dayComments, newComment];
    this.dayComments = this.sortDayComments(updated);

    this.dayDoc
      .set(
        {
          dateKey: this.dayKey,
          comments: this.dayComments,
          updatedAt: time,
        },
        { merge: true }
      )
      .then(() => {
        this.dayCommentText = '';
      })
      .catch((err) => {
        console.error('Failed to post day comment:', err);
        alert('Impossible de publier le commentaire.');
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
