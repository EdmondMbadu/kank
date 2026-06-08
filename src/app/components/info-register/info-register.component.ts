import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { Client, Comment } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';

type ClientVerificationState = 'verified' | 'unverified' | 'rejected';
type RegisterClientListItem = Client & {
  verificationState: ClientVerificationState;
  verificationLabel: string;
  latestAuditComment?: Comment | null;
  latestAuditCommentReason?: string;
  latestAuditCommentPreview?: string;
};

@Component({
  selector: 'app-info-register',
  templateUrl: './info-register.component.html',
  styleUrls: ['./info-register.component.css'],
})
export class InfoRegisterComponent implements OnInit {
  clients: RegisterClientListItem[] = [];
  currentRegisterClients: RegisterClientListItem[] = [];
  filteredItems: RegisterClientListItem[] = [];
  searchControl = new FormControl();
  constructor(private router: Router, public auth: AuthService) {
    this.retrieveClients();
  }
  debts: string[] = [];
  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => this.search(value))
      )
      .subscribe((results) => {
        this.filteredItems = results;
      });
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: Client[] | Client | null | undefined) => {
      const clients = Array.isArray(data) ? data : data ? [data] : [];

      this.clients = clients.map((client, index) =>
        this.buildRegisterClientListItem(client, index)
      );
      this.findClientsRegistered();
      this.filteredItems = [...this.currentRegisterClients];
    });
  }

  private buildRegisterClientListItem(
    client: Client,
    index: number
  ): RegisterClientListItem {
    const verificationState = this.getVerificationState(client);
    const latestAuditComment =
      verificationState === 'unverified' ? this.getLatestAuditComment(client) : null;

    return {
      ...client,
      trackingId: `${index}`,
      verificationState,
      verificationLabel: this.getVerificationLabel(verificationState),
      latestAuditComment,
      latestAuditCommentReason: latestAuditComment
        ? this.auditCommentReason(latestAuditComment)
        : '',
      latestAuditCommentPreview: latestAuditComment
        ? this.commentPreview(latestAuditComment)
        : '',
    };
  }

  private getVerificationState(client: Client): ClientVerificationState {
    if (client.requestType === 'rejection') {
      return 'rejected';
    }

    return this.isClientVerified(client) ? 'verified' : 'unverified';
  }

  private getVerificationLabel(state: ClientVerificationState): string {
    switch (state) {
      case 'verified':
        return 'Vérifié';
      case 'rejected':
        return 'Rejet en cours';
      default:
        return 'Non vérifié';
    }
  }

  isClientVerified(client: Client): boolean {
    return String(client.agentSubmittedVerification).trim().toLowerCase() === 'true';
  }

  hasAuditCommentWarning(client: RegisterClientListItem): boolean {
    return client.verificationState === 'unverified' && !!client.latestAuditComment;
  }

  private getLatestAuditComment(client: Client): Comment | null {
    const comments = Array.isArray(client.comments) ? client.comments : [];
    const auditComments = comments.filter((comment) =>
      this.isAuditClientComment(comment)
    );

    if (!auditComments.length) return null;

    return [...auditComments].sort(
      (a, b) => this.commentTimeValue(b) - this.commentTimeValue(a)
    )[0];
  }

  private isAuditClientComment(comment?: Comment | null): boolean {
    if (!comment) return false;
    return (
      comment.source === 'register-portal-audit' ||
      !!comment.category ||
      !!comment.commentType ||
      !!comment.tag
    );
  }

  private auditCommentReason(comment: Comment): string {
    return (
      comment.categoryLabel ||
      this.auditCommentTagLabel(comment.category || comment.commentType || comment.tag) ||
      'Commentaire audit'
    );
  }

  private auditCommentTagLabel(value?: string | null): string {
    switch (value) {
      case 'no_answer':
        return "Client n'a pas répondu à l'appel";
      case 'fraud':
        return 'Client fraude';
      case 'other':
        return 'Autres';
      default:
        return value || '';
    }
  }

  private commentPreview(comment: Comment): string {
    const text = (comment.comment || '').trim();
    if (!text) {
      return comment.audioUrl ? 'Audio joint au commentaire.' : 'Détails à consulter.';
    }
    return text.length > 90 ? `${text.slice(0, 90)}...` : text;
  }

  private commentTimeValue(comment: Comment): number {
    if (!comment.time) return 0;
    const [month, day, year, hour = 0, minute = 0, second = 0] = comment.time
      .split('-')
      .map(Number);

    if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
      return 0;
    }

    return new Date(year, month - 1, day, hour, minute, second).getTime();
  }

  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.currentRegisterClients.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue) ||
            client.amountPaid?.includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.currentRegisterClients);
    }
  }
  findClientsRegistered() {
    this.currentRegisterClients = [];
    this.clients.forEach((client) => {
      if (client.type !== undefined && client.type === 'register') {
        this.currentRegisterClients.push(client);
      }
    });
  }
}
