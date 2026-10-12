import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';
import { AuditConversationAudioAttachment, Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { ClientCycleComponent } from './client-cycle.component';

// Exercise the actual template and snapshot subscription, not just a getter.
describe('ClientCycleComponent archived verification audio', () => {
  let component: ClientCycleComponent;
  let fixture: ComponentFixture<ClientCycleComponent>;
  let cycle$: BehaviorSubject<Client>;
  let archived: Client;
  let auth: any;
  let data: any;
  let storage: any;
  const oldAudio: AuditConversationAudioAttachment = {
    url: 'https://example.com/cycle-two.m4a', debtCycle: '2',
    name: 'AUD-20260509-WA0070.m4a', mimeType: 'audio/x-m4a',
    recordedAt: new Date(2026, 4, 9, 9).toISOString(),
    uploadedAt: '5-9-2026-14-40-0', uploadedBy: 'Auditeur',
  };
  const recentAudio: AuditConversationAudioAttachment = {
    url: 'https://example.com/current-cycle.m4a', debtCycle: '3',
    recordedAt: new Date(2026, 9, 6, 9).toISOString(), uploadedAt: '10-6-2026-11-0-0',
  };

  function section(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="cycle-audit-conversation"]');
  }

  function players(): NodeListOf<HTMLAudioElement> {
    return fixture.nativeElement.querySelectorAll('#cycle-audit-conversation-audios audio');
  }

  function openConversation(): void {
    section()!.querySelector('button')!.click();
    fixture.detectChanges();
  }

  function loadSnapshot(fields: Partial<Client>): void {
    cycle$.next({ ...archived, ...fields });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    archived = Object.assign(new Client(), {
      uid: 'archivedClient', cycleId: 'archivedCycle', debtCycle: '2',
      firstName: 'Sarah', middleName: 'Mule', lastName: 'Kasongo',
      type: '', requestType: '', dateOfRequest: '6-1-2026-10-0-0',
      auditConversationCycleStartedAt: '5-9-2026-10-0-0',
      debtCycleStartDate: '5-12-2026', dateJoined: '5-9-2026',
      paymentDay: 'Monday', paymentPeriodRange: '4', amountToPay: '120000',
      loanAmount: '100000', amountPaid: '120000', debtLeft: '0',
      creditScore: '100', savings: '5000', agent: 'agent-one',
      auditConversationAudios: [oldAudio],
      comments: [{ name: 'Agent', comment: 'Commentaire du cycle', time: '5-9-2026-15-0-0', audioUrl: 'https://example.com/comment.webm' }],
    });
    cycle$ = new BehaviorSubject(archived);
    const live = { ...archived, debtCycle: '3', auditConversationAudios: [recentAudio] };
    auth = {
      currentUser: { uid: 'site', email: 'admin@kank.test', firstName: 'Admin' },
      isAdmin: true, isDistributor: false,
      getAllClients: () => of([{ uid: 'otherClient' }, live]),
      getClient: jasmine.createSpy('getClient').and.returnValue(of(live)),
      getAllEmployees: () => of([{ uid: 'agent-one', firstName: 'Agent' }]),
    };
    data = {
      getClientCycle: jasmine.createSpy('getClientCycle').and.returnValue(cycle$.asObservable()),
      setClientFields: jasmine.createSpy('setClientFields'),
    };
    storage = { storage: { refFromURL: jasmine.createSpy('refFromURL') } };
    await TestBed.configureTestingModule({
      declarations: [ClientCycleComponent],
      imports: [CommonModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: DataService, useValue: data },
        { provide: AngularFireStorage, useValue: storage },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'archivedClient-archivedCycle' } } } },
        { provide: ComputationService, useValue: { computeAge: () => 30, getGradientColor: () => '#16a34a' } },
        TimeService,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(ClientCycleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the requested archived snapshot and keeps the current portal as the back link', () => {
    expect(auth.getClient).toHaveBeenCalledOnceWith('archivedClient');
    expect(data.getClientCycle).toHaveBeenCalledOnceWith('archivedClient', 'archivedCycle');
    expect(component.client.debtCycle).toBe('2');
    expect(component.clientCycle.debtCycle).toBe('3');
    expect(component.clientIndex).toBe(1);
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Cycle Précédent - 2');
    const backLink = fixture.debugElement.query(By.css('header button')).injector.get(RouterLink);
    expect(TestBed.inject(Router).serializeUrl(backLink.urlTree!)).toBe('/client-portal/1');
  });

  it('renders only that cycle audio with controls, file details and formatted dates', () => {
    expect(section()!.textContent).toContain('Conversation avec le client — cycle 2');
    expect(players().length).toBe(0);
    openConversation();
    expect(players().length).toBe(1);
    expect(players()[0].getAttribute('src')).toBe(oldAudio.url);
    expect(players()[0].controls).toBeTrue();
    expect(players()[0].preload).toBe('none');
    expect(players()[0].getAttribute('aria-label')).toContain('cycle 2');
    expect(section()!.textContent).toContain(oldAudio.name!);
    expect(section()!.textContent).toContain('Auditeur');
    expect(section()!.textContent).toContain('audio/x-m4a');
    expect(section()!.textContent).toContain(component.auditConversationAudioUploadedAtFor(oldAudio));
    expect(section()!.textContent).toContain(component.auditConversationAudioRecordedAtFormatted(oldAudio));
    expect(component.auditConversationAudioAttachments).toEqual([oldAudio]);
    expect(fixture.nativeElement.querySelector(`audio[src="${recentAudio.url}"]`)).toBeNull();
  });

  it('supports multiple recordings on the same cycle and hides other explicit cycle tags', () => {
    const second = { ...oldAudio, url: 'https://example.com/second.m4a', name: 'Second entretien' };
    loadSnapshot({ auditConversationAudios: [oldAudio, { ...oldAudio, debtCycle: '1' }, recentAudio, second] });
    openConversation();
    expect(Array.from(players()).map((player) => player.getAttribute('src'))).toEqual([oldAudio.url, second.url]);
  });

  it('supports legacy scalar recordings without falling back to the current client', () => {
    loadSnapshot({
      auditConversationAudios: undefined, auditConversationAudioUrl: oldAudio.url,
      auditConversationAudioName: oldAudio.name, auditConversationAudioRecordedAt: oldAudio.recordedAt,
      auditConversationAudioUploadedAt: oldAudio.uploadedAt,
    });
    openConversation();
    expect(players()[0].getAttribute('src')).toBe(oldAudio.url);
    // Repeated change detection must not replace an actively playing element.
    const player = players()[0];
    fixture.detectChanges();
    fixture.detectChanges();
    expect(players()[0]).toBe(player);
  });

  it('keeps legacy audio stored on its own snapshot when cycle-boundary metadata is absent', () => {
    loadSnapshot({ auditConversationCycleStartedAt: undefined, auditConversationAudios: undefined,
      auditConversationAudioUrl: oldAudio.url });
    openConversation();
    expect(players()[0].getAttribute('src')).toBe(oldAudio.url);
  });

  it('does not resurrect a scalar reference when the archived audio array was explicitly cleared', () => {
    loadSnapshot({ auditConversationAudios: [], auditConversationAudioUrl: oldAudio.url });
    expect(section()).toBeNull();
    expect(component.auditConversationAudioAttachments).toEqual([]);
  });

  it('shows no current-cycle recording on an archive that never contained verification audio', () => {
    loadSnapshot({ auditConversationAudios: undefined, auditConversationAudioUrl: undefined });
    expect(section()).toBeNull();
    expect(component.clientCycle.auditConversationAudios).toEqual([recentAudio]);
    expect(component.auditConversationAudioAttachments).toEqual([]);
  });

  it('rejects audio recorded before the archived cycle registration', () => {
    loadSnapshot({ auditConversationAudios: [{ ...oldAudio, recordedAt: new Date(2026, 4, 8, 9).toISOString() }] });
    expect(section()).toBeNull();
  });

  it('hides blank or malformed stored audio without affecting the profile', () => {
    loadSnapshot({ auditConversationAudios: [{ ...oldAudio, url: '' }] });
    expect(section()).toBeNull();
    loadSnapshot({ auditConversationAudios: null as any });
    expect(section()).toBeNull();
    expect(component.avgPerf).toBe(100);
  });

  it('matches the current portal role visibility for administrators and distributors', () => {
    auth.isAdmin = false;
    fixture.detectChanges();
    expect(section()).toBeNull();
    auth.isDistributor = true;
    fixture.detectChanges();
    expect(section()).not.toBeNull();
    openConversation();
    expect(players().length).toBe(1);
  });

  it('is read-only and keeps the existing comment audio and payment details', () => {
    openConversation();
    expect(section()!.querySelectorAll('button').length).toBe(1);
    expect(section()!.textContent).not.toContain('Supprimer');
    expect(data.setClientFields).not.toHaveBeenCalled();
    expect(storage.storage.refFromURL).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('audio[src="https://example.com/comment.webm"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Commentaire du cycle');
    expect(component.minPay).toBe('30000');
    expect(component.agent?.uid).toBe('agent-one');
    expect(component.isGold).toBeTrue();
  });
});
