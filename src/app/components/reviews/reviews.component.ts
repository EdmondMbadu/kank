import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Comment } from 'src/app/models/client';
import { User } from 'src/app/models/user';
import { Employee } from 'src/app/models/employee';
import { IdeaAttachment, IdeaSubmission } from 'src/app/models/idea';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

type MetricDefinition = {
  key: string;
  label: string;
  measure?: string;
  criteria?: string;
};

type MetricState = MetricDefinition & { value: number };

@Component({
  selector: 'app-reviews',
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.css'],
})
export class ReviewsComponent implements OnInit, OnDestroy {
  personPostingComment?: string = '';
  numberofStars: string = '';
  comment?: string = '';
  reviews: Comment[] = [];
  showForm = false;
  showCommentDescription = false;
  // valeur du champ Performance
  performanceValue = 0;

  // objet graphique
  graphPerf: any = { data: [], layout: {}, config: {} };
  readonly performanceRanges: Array<{
    value: '3m' | '6m' | 'max';
    label: string;
  }> = [
    { value: '3m', label: '3 mois' },
    { value: '6m', label: '6 mois' },
    { value: 'max', label: 'Max (12 mois)' },
  ];
  selectedRange: '3m' | '6m' | 'max' = 'max';
  latestPerformance: number | null = null;
  performanceDelta: number | null = null;
  toggleForm() {
    this.showForm = !this.showForm;
    this.showCommentDescription = this.showForm;
  }
  toggleCommentDescription(): void {
    this.showCommentDescription = !this.showCommentDescription;
    this.showForm = this.showCommentDescription;
  }
  toggleIndividualForm(): void {
    this.individualShowForm = !this.individualShowForm;
    this.individualShowCommentDescription = this.individualShowForm;
  }
  toggleIndividualCommentDescription(): void {
    this.individualShowCommentDescription =
      !this.individualShowCommentDescription;
    this.individualShowForm = this.individualShowCommentDescription;
  }
  /* ---------- NOUVEAU : sliders ---------- */
  readonly teamMetricDefinitions: MetricDefinition[] = [
    { key: 'ponctualite', label: 'Arrive à l’heure' },
    { key: 'proprete', label: 'La Foundation est propre' },
    {
      key: 'cahier',
      label: 'Cahiers et carnets à jour, exacts, sans fraude ni détournement',
    },
    {
      key: 'suiviClients',
      label: 'A visité les clients ne s’étant pas présentés pour payer',
    },
    {
      key: 'relationClient',
      label: 'Traite les clients avec respect et sérieux',
    },
  ];

  readonly individualMetricDefinitions: MetricDefinition[] = [
    {
      key: 'ponctualite',
      label: 'Ponctualité & Présence',
      measure: 'Respect du temps de travail',
      criteria: 'Arrivée à l’heure, pauses raisonnables, disponibilité',
    },
    {
      key: 'proprete',
      label:
        'Respect des Procédures & Traçabilité (e.g commentaires, justificatifs, aucune fraude)',
      measure: 'Professionnalisme dans la présentation et l’ordre',
      criteria: 'Uniforme propre, bureau propre, cahiers/carnets bien tenus',
    },
    {
      key: 'suiviClients',
      label: 'Suivi des Clients (Rappel & Visites)',
      measure: 'Engagement dans le suivi de portefeuille',
      criteria:
        'Appels réguliers, visites des absents, suivi des cas compliqués',
    },
    {
      key: 'relationClient',
      label: 'Qualité de l’Interaction  avec les Clients',
      measure: 'Respect, écoute, transparence',
      criteria: 'Ton utilisé, patience, capacité à expliquer clairement',
    },
    {
      key: 'attitudeEquipe',
      label: 'Attitude & Esprit d’Équipe',
      measure: 'Collaboration et contribution au bon climat interne',
      criteria: 'Respect des collègues, initiative, volonté d’aider',
    },
  ];

  metrics: MetricState[] = this.teamMetricDefinitions.map((def) => ({
    ...def,
    value: 0,
  }));

  individualMetrics: MetricState[] = this.individualMetricDefinitions.map(
    (def) => ({
      ...def,
      value: 0,
    })
  );

  /** liste statique pour l’affichage des barres */
  readonly metricsKeys = this.buildMetricsKeys();

  /* ---------- Aperçu ---------- */
  previewOpen = false;
  previewContext: 'team' | 'individual' | null = null;

  teamCode: string = '';
  isRecording = false;
  mediaRecorder!: MediaRecorder;
  audioChunks: BlobPart[] = []; // Will store the recorded audio data (chunks)
  recordedBlob?: Blob; // Final audio blob
  recordedAudioURL?: string; // Local blob URL for playback in the UI
  commentAudioUrl: string = ''; // Final upload URL from Firebase

  selectedAudioFile?: File;
  selectedAudioPreviewURL?: string; // For local preview
  // Optional image attachment
  selectedImageFile?: File;
  selectedImagePreviewURL?: string;

  // Individual comment composer state
  individualShowForm = false;
  individualShowCommentDescription = false;
  individualPersonPostingComment = '';
  individualNumberOfStars: string = '';
  individualComment = '';
  individualSelectedTargetUserId: string | null = null;
  individualIsRecording = false;
  individualMediaRecorder!: MediaRecorder;
  individualAudioChunks: BlobPart[] = [];
  individualRecordedBlob?: Blob;
  individualRecordedAudioURL?: string;
  individualSelectedAudioFile?: File;
  individualSelectedAudioPreviewURL?: string;
  individualSelectedImageFile?: File;
  individualSelectedImagePreviewURL?: string;
  individualElapsedTime = '00:00';
  individualRecordingProgress = 0;
  private individualRecordingTimer: any;
  individualPerformanceValue = 0;

  // Admin image-replace target: stores which review/attachment index we are editing
  adminReplaceTarget: { reviewIndex: number; attachmentIndex: number } | null =
    null;

  elapsedTime = '00:00';
  recordingProgress = 0;
  private recordingTimer: any;

  // --- Boîte à idées ---
  showIdeaForm = false;
  showIdeaDescription = false;
  ideaEmployeeName = '';
  ideaText = '';
  ideaSelectedImageFile?: File;
  ideaSelectedImagePreviewURL?: string;
  ideaSelectedAudioFile?: File;
  ideaSelectedAudioPreviewURL?: string;
  ideaMediaRecorder?: MediaRecorder;
  ideaAudioChunks: BlobPart[] = [];
  ideaRecordedBlob?: Blob;
  ideaRecordedAudioURL?: string;
  ideaIsRecording = false;
  ideaElapsedTime = '00:00';
  ideaRecordingProgress = 0;
  private ideaRecordingTimer: any;
  ideaSubmissionBusy = false;
  ideaSubmissionSuccess = false;
  ideaSubmissionMessage = '';

  allUsers: User[] = [];
  employeeOptions: Employee[] = [];
  private employeeSubs: Subscription[] = [];
  selectedTargetUserId: string | null = null;
  isAuthenticated = false;
  private authSub?: Subscription;
  private reviewsSub?: Subscription;
  private usersSub?: Subscription;
  submissionSuccess = false;
  submissionTargetLabel = '';
  submissionContext: 'team' | 'individual' | null = null;

  constructor(
    private router: Router,
    public auth: AuthService,
    private storage: AngularFireStorage,
    private data: DataService,
    public time: TimeService,
    public compute: ComputationService,
    private cd: ChangeDetectorRef
  ) {}
  reviewId: string = '';

  monthName = new Date().toLocaleDateString('fr-FR', { month: 'long' });

  /** Objectif stocké dans le profil (champ : objectifPerformance) */
  get objective(): number {
    return Number(this.auth.currentUser?.objectifPerformance ?? 0);
  }

  ngOnInit(): void {
    this.authSub = this.auth.user$.subscribe((user) => {
      this.isAuthenticated = !!user;
      if (!this.isAuthenticated) {
        this.showForm = true;
      }

      if (this.reviewsSub) {
        this.reviewsSub.unsubscribe();
        this.reviewsSub = undefined;
      }

      if (user?.uid) {
        if (!this.selectedTargetUserId) {
          this.selectedTargetUserId = user.uid;
        }
        if (!this.individualSelectedTargetUserId) {
          this.individualSelectedTargetUserId = user.uid;
        }
        this.reviewsSub = this.auth.getReviews().subscribe((data: any[]) => {
          if (data?.length) {
            const doc = data[0] || {};
            this.reviews = doc.reviews || [];
            this.reviewId = doc.reviewId || '';
          } else {
            this.reviews = [];
            this.reviewId = '';
          }
          this.setReviews();
        });
      } else {
        this.selectedTargetUserId = null;
        this.individualSelectedTargetUserId = null;
        this.reviews = [];
        this.reviewId = '';
        this.setReviews();
      }
    });

    this.usersSub = this.auth.getAllUsersInfo().subscribe((users) => {
      const list = users ?? [];
      this.allUsers = list.slice().sort((a: User, b: User) => {
        const aName = (
          a.firstName ||
          a.lastName ||
          a.email ||
          ''
        ).toLowerCase();
        const bName = (
          b.firstName ||
          b.lastName ||
          b.email ||
          ''
        ).toLowerCase();
        return aName.localeCompare(bName);
      });
      this.refreshEmployeeOptions();
      this.setReviews();
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.reviewsSub?.unsubscribe();
    this.usersSub?.unsubscribe();
    this.employeeSubs.forEach((sub) => sub.unsubscribe());
    this.employeeSubs = [];
    this.stopIndividualTimer();
    this.stopIdeaTimer();
  }

  setReviews() {
    if (this.reviews) {
      // add the formatted time
      this.reviews.forEach((comment) => {
        comment.timeFormatted = this.time.convertDateToDesiredFormat(
          comment.time!
        );
        comment.starsNumber = Number(comment.stars);
        comment.__editingPerf = false; // ← initialise
        comment.__perfDraft = comment.performance ?? 0; // ← brouillon
        const resolvedLabel =
          comment.scope === 'individual'
            ? this.getEmployeeLabelById(
                comment.targetUserId,
                comment.targetUserLastName ?? ''
              )
            : this.getUserLabelById(
                comment.targetUserId,
                comment.targetUserLastName ?? ''
              );
        if (resolvedLabel) {
          comment.targetUserLastName = resolvedLabel;
        }
      });
    }
    this.reviews.sort((a: any, b: any) => {
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
    this.buildPerformanceGraph();
  }
  private startTimer() {
    let seconds = 0;
    this.recordingTimer = setInterval(() => {
      seconds++;
      this.elapsedTime = this.formatTime(seconds);
      this.recordingProgress = (seconds / 60) * 100; // Assuming max recording time is 60 seconds
    }, 1000);
  }
  private startIndividualTimer() {
    let seconds = 0;
    this.individualRecordingTimer = setInterval(() => {
      seconds++;
      this.individualElapsedTime = this.formatTime(seconds);
      this.individualRecordingProgress = (seconds / 60) * 100;
    }, 1000);
  }
  private stopIndividualTimer() {
    if (this.individualRecordingTimer) {
      clearInterval(this.individualRecordingTimer);
      this.individualRecordingTimer = undefined;
    }
  }
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${this.pad(minutes)}:${this.pad(secs)}`;
  }
  getLimitedProgress(): number {
    return Math.min(this.recordingProgress, 100);
  }
  getIndividualLimitedProgress(): number {
    return Math.min(this.individualRecordingProgress, 100);
  }
  private refreshEmployeeOptions(): void {
    this.employeeSubs.forEach((sub) => sub.unsubscribe());
    this.employeeSubs = [];
    this.employeeOptions = [];

    if (!this.allUsers?.length) {
      return;
    }

    const seen = new Map<string, Employee>();
    this.allUsers.forEach((user) => {
      const sub = this.auth
        .getAllEmployeesGivenUser(user)
        .subscribe((employees) => {
          const employeeList: Employee[] = Array.isArray(employees)
            ? (employees as Employee[])
            : [];
          employeeList.forEach((employee) => {
            if (!employee?.uid) {
              return;
            }

            const normalizedStatus = (employee.status || '')
              .toString()
              .trim()
              .toLowerCase();
            if (normalizedStatus !== 'travaille') {
              return;
            }

            const enriched: Employee = {
              ...employee,
              tempUser: user,
              tempLocationHolder:
                employee.tempLocationHolder || user.firstName || '',
            };
            seen.set(employee.uid, enriched);
          });

          this.employeeOptions = Array.from(seen.values()).sort((a, b) => {
            const nameA = `${(a.firstName || '').trim()} ${(
              a.lastName || ''
            ).trim()}`
              .trim()
              .toLowerCase();
            const nameB = `${(b.firstName || '').trim()} ${(
              b.lastName || ''
            ).trim()}`
              .trim()
              .toLowerCase();

            if (nameA && nameB) {
              const cmp = nameA.localeCompare(nameB);
              if (cmp !== 0) {
                return cmp;
              }
            }

            return (a.tempLocationHolder || '')
              .toLowerCase()
              .localeCompare((b.tempLocationHolder || '').toLowerCase());
          });

          this.ensureIndividualDefaultTarget();
          this.setReviews();
        });

      this.employeeSubs.push(sub);
    });
  }
  private ensureIndividualDefaultTarget(): void {
    if (
      !this.individualSelectedTargetUserId &&
      this.employeeOptions.length > 0
    ) {
      this.individualSelectedTargetUserId = this.employeeOptions[0].uid ?? null;
    } else if (!this.employeeOptions.length) {
      this.individualSelectedTargetUserId = null;
    }
  }
  private getUserLabelById(userId?: string | null, fallback = ''): string {
    if (!userId) {
      return fallback;
    }
    const user = this.allUsers.find((u) => u.uid === userId);
    return user?.firstName || user?.lastName || user?.email || fallback;
  }
  private getEmployeeLabelById(
    employeeId?: string | null,
    fallback = ''
  ): string {
    if (!employeeId) {
      return fallback;
    }
    const employee = this.employeeOptions.find((e) => e.uid === employeeId);
    if (!employee) {
      return fallback;
    }

    const name = [employee.firstName, employee.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const location =
      employee.tempLocationHolder || employee.tempUser?.firstName || '';

    if (name && location) {
      return `${name} – ${location}`;
    }
    if (name) {
      return name;
    }
    if (location) {
      return location;
    }
    return fallback || employee.uid || '';
  }
  getSelectedTargetLabel(
    targetUserId: string | null | undefined = this.selectedTargetUserId
  ): string {
    return this.getUserLabelById(targetUserId);
  }
  getIndividualSelectedTargetLabel(
    targetUserId: string | null | undefined = this
      .individualSelectedTargetUserId
  ): string {
    return this.getEmployeeLabelById(targetUserId);
  }
  displayEmployeeOption(employee: Employee | null | undefined): string {
    if (!employee) {
      return '';
    }
    return this.getEmployeeLabelById(employee.uid, '');
  }
  getMetricLabel(metricKey: string, scope?: 'team' | 'individual'): string {
    if (scope === 'individual') {
      const individual = this.individualMetricDefinitions.find(
        (def) => def.key === metricKey
      );
      if (individual?.label) {
        return individual.label;
      }
    }

    const team =
      this.teamMetricDefinitions.find((def) => def.key === metricKey) ||
      this.individualMetricDefinitions.find((def) => def.key === metricKey);
    return team?.label ?? metricKey;
  }
  private pad(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
  }

  // addReview(audioUrl: string) {
  //   try {
  //     const review = {
  //       name: this.personPostingComment,
  //       comment: this.comment,
  //       time: this.time.todaysDate(),
  //       stars: this.numberofStars,
  //       audioUrl: audioUrl, // could be '' if none
  //     };

  //     this.auth.addReview(review).then(() => {
  //       this.personPostingComment = '';
  //       this.comment = '';
  //       this.numberofStars = '';
  //     });
  //   } catch (error) {
  //     console.error('Error adding review:', error);
  //     alert(
  //       "Une erreur s'est produite lors de la publication du commentaire. Essayez à nouveau."
  //     );
  //   }
  // }
  async startRecording() {
    try {
      // 1) getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2) pick a mimeType
      const preferredMimeTypes = [
        'audio/mp4;codecs=mp4a',
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
      ];

      let selectedMimeType = '';
      for (const mt of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
          selectedMimeType = mt;
          break;
        }
      }
      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};

      // 3) create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, options);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // 4) start
      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordingProgress = 0;
      this.elapsedTime = '00:00';
      this.startTimer();
      console.log(
        'Recording started with mimeType:',
        selectedMimeType || 'browser default'
      );
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert(
        'Could not access the microphone. Check permissions and try again.'
      );
    }
  }

  stopRecording() {
    if (!this.mediaRecorder) return;

    // Stop the MediaRecorder
    this.mediaRecorder.stop();
    this.isRecording = false;
    clearInterval(this.recordingTimer);

    // Once it fully stops, combine the chunks into a single Blob
    this.mediaRecorder.onstop = () => {
      this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

      // Create a local URL for immediate playback
      this.recordedAudioURL = URL.createObjectURL(this.recordedBlob);

      console.log('Recording complete. Blob size:', this.recordedBlob.size);
      console.log('the local url', this.recordedAudioURL);
      // The user can now preview the audio right away
      // Force Angular to detect the new value
      this.cd.detectChanges();
    };
  }

  async startIndividualRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeTypes = [
        'audio/mp4;codecs=mp4a',
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
      ];

      let selectedMimeType = '';
      for (const mt of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
          selectedMimeType = mt;
          break;
        }
      }
      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};

      this.individualMediaRecorder = new MediaRecorder(stream, options);
      this.individualAudioChunks = [];

      this.individualMediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          this.individualAudioChunks.push(event.data);
        }
      };

      this.individualMediaRecorder.start();
      this.individualIsRecording = true;
      this.individualRecordingProgress = 0;
      this.individualElapsedTime = '00:00';
      this.startIndividualTimer();
    } catch (err) {
      console.error('Error accessing microphone for individual feedback:', err);
      alert(
        'Impossible d’accéder au microphone pour le commentaire individuel.'
      );
    }
  }

  stopIndividualRecording() {
    if (!this.individualMediaRecorder) {
      return;
    }

    this.individualMediaRecorder.stop();
    this.individualIsRecording = false;
    this.stopIndividualTimer();

    this.individualMediaRecorder.onstop = () => {
      this.individualRecordedBlob = new Blob(this.individualAudioChunks, {
        type: 'audio/webm',
      });
      this.individualRecordedAudioURL = URL.createObjectURL(
        this.individualRecordedBlob
      );
      this.cd.detectChanges();
    };
  }

  private async uploadRecordedBlobAndThenPostComment(targetUserId: string) {
    try {
      // Convert Blob -> File
      const fileName = `recorded-${Date.now()}.webm`;
      const audioFile = new File([this.recordedBlob!], fileName, {
        type: this.recordedBlob!.type,
      });

      const path = `reviews/${targetUserId}-${fileName}`;
      const uploadTask = await this.storage.upload(path, audioFile);
      const downloadURL = await uploadTask.ref.getDownloadURL();

      // Now finalize
      this.submitReview('team', {
        audioUrl: downloadURL,
        targetUserId,
      });

      // Reset local fields
      this.recordedBlob = undefined;
      this.recordedAudioURL = '';
    } catch (error) {
      console.error('Error uploading recorded blob:', error);
      alert('Erreur lors du téléversement de votre enregistrement.');
    }
  }
  private async uploadSelectedFileAndThenPostComment(targetUserId: string) {
    try {
      const fileName = `upload-${Date.now()}-${this.selectedAudioFile?.name}`;
      const path = `reviews/${targetUserId}-${fileName}`;

      const uploadTask = await this.storage.upload(
        path,
        this.selectedAudioFile!
      );
      const downloadURL = await uploadTask.ref.getDownloadURL();

      // Now finalize
      this.submitReview('team', {
        audioUrl: downloadURL,
        targetUserId,
      });

      // Reset local fields
      if (this.selectedAudioPreviewURL) {
        URL.revokeObjectURL(this.selectedAudioPreviewURL);
      }
      this.selectedAudioPreviewURL = undefined;
      this.selectedAudioFile = undefined;
    } catch (error) {
      console.error('Error uploading selected file:', error);
      alert('Erreur lors du téléversement du fichier audio.');
    }
  }

  private async uploadIndividualRecordedBlobAndThenPostComment(
    targetUserId: string
  ) {
    try {
      const fileName = `recorded-individual-${Date.now()}.webm`;
      const audioFile = new File([this.individualRecordedBlob!], fileName, {
        type: this.individualRecordedBlob!.type,
      });

      const path = `reviews/${targetUserId}-${fileName}`;
      const uploadTask = await this.storage.upload(path, audioFile);
      const downloadURL = await uploadTask.ref.getDownloadURL();

      this.submitReview('individual', {
        audioUrl: downloadURL,
        targetUserId,
      });

      this.individualRecordedBlob = undefined;
      this.individualRecordedAudioURL = '';
    } catch (error) {
      console.error(
        'Error uploading recorded blob for individual comment:',
        error
      );
      alert('Erreur lors du téléversement de votre enregistrement individuel.');
    }
  }

  private async uploadIndividualSelectedFileAndThenPostComment(
    targetUserId: string
  ) {
    try {
      const fileName = `upload-individual-${Date.now()}-${
        this.individualSelectedAudioFile?.name
      }`;
      const path = `reviews/${targetUserId}-${fileName}`;

      const uploadTask = await this.storage.upload(
        path,
        this.individualSelectedAudioFile!
      );
      const downloadURL = await uploadTask.ref.getDownloadURL();

      this.submitReview('individual', {
        audioUrl: downloadURL,
        targetUserId,
      });

      if (this.individualSelectedAudioPreviewURL) {
        URL.revokeObjectURL(this.individualSelectedAudioPreviewURL);
      }
      this.individualSelectedAudioPreviewURL = undefined;
      this.individualSelectedAudioFile = undefined;
    } catch (error) {
      console.error(
        'Error uploading selected file for individual comment:',
        error
      );
      alert('Erreur lors du téléversement du fichier audio individuel.');
    }
  }

  private async uploadIndividualImageAndThenPostComment(targetUserId: string) {
    try {
      if (!this.individualSelectedImageFile) return;

      const fileName = `image-individual-${Date.now()}-${
        this.individualSelectedImageFile.name
      }`;
      const path = `reviews/${targetUserId}-${fileName}`;

      const uploadTask = await this.storage.upload(
        path,
        this.individualSelectedImageFile
      );
      const downloadURL = await uploadTask.ref.getDownloadURL();

      const attachment = {
        type: 'image',
        url: downloadURL,
        mimeType: this.individualSelectedImageFile.type,
        size: this.individualSelectedImageFile.size,
      } as any;

      this.submitReview('individual', {
        audioUrl: '',
        targetUserId,
        attachments: [attachment],
      });

      if (this.individualSelectedImagePreviewURL) {
        URL.revokeObjectURL(this.individualSelectedImagePreviewURL);
      }
      this.individualSelectedImagePreviewURL = undefined;
      this.individualSelectedImageFile = undefined;
    } catch (error) {
      console.error('Error uploading image for individual comment:', error);
      alert("Erreur lors du téléversement de l'image individuelle.");
    }
  }

  private async uploadImageAndThenPostComment(targetUserId: string) {
    try {
      if (!this.selectedImageFile) return;

      const fileName = `image-${Date.now()}-${this.selectedImageFile.name}`;
      const path = `reviews/${targetUserId}-${fileName}`;

      const uploadTask = await this.storage.upload(
        path,
        this.selectedImageFile
      );
      const downloadURL = await uploadTask.ref.getDownloadURL();

      const attachment = {
        type: 'image',
        url: downloadURL,
        mimeType: this.selectedImageFile.type,
        size: this.selectedImageFile.size,
      } as any;

      this.submitReview('team', {
        audioUrl: '',
        targetUserId,
        attachments: [attachment],
      });

      // cleanup
      if (this.selectedImagePreviewURL) {
        URL.revokeObjectURL(this.selectedImagePreviewURL);
      }
      this.selectedImagePreviewURL = undefined;
      this.selectedImageFile = undefined;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert("Erreur lors du téléversement de l'image.");
    }
  }

  // Let user discard the current recording if they don’t want it
  discardAudio() {
    // 1) If we were actively recording, stop the recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
    this.audioChunks = [];
    this.recordedBlob = undefined;
    this.recordedAudioURL = undefined;

    // 2) If we had selected an audio file to upload, clear that
    if (this.selectedAudioPreviewURL) {
      // Revoke the object URL to free memory
      URL.revokeObjectURL(this.selectedAudioPreviewURL);
    }
    this.selectedAudioPreviewURL = undefined;
    this.selectedAudioFile = undefined;
    // 3) Also reset the <input> value so the user can pick the same file again
    const input = document.getElementById('audioFile') as HTMLInputElement;
    if (input) {
      input.value = '';
    }

    console.log('Audio canceled/reset.');
  }

  discardIndividualAudio() {
    if (
      this.individualMediaRecorder &&
      this.individualMediaRecorder.state !== 'inactive'
    ) {
      this.individualMediaRecorder.stop();
    }
    this.individualIsRecording = false;
    this.individualAudioChunks = [];
    this.individualRecordedBlob = undefined;
    if (this.individualRecordedAudioURL) {
      URL.revokeObjectURL(this.individualRecordedAudioURL);
    }
    this.individualRecordedAudioURL = undefined;
    this.stopIndividualTimer();

    if (this.individualSelectedAudioPreviewURL) {
      URL.revokeObjectURL(this.individualSelectedAudioPreviewURL);
    }
    this.individualSelectedAudioPreviewURL = undefined;
    this.individualSelectedAudioFile = undefined;

    const input = document.getElementById(
      'individualAudioFile'
    ) as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }

  onAudioFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const file = fileList[0];

    // Optional: Check size, type, etc.
    if (file.size >= 20000000) {
      alert('Le fichier audio dépasse la limite de 20MB.');
      return;
    }

    if (file.type.split('/')[0] !== 'audio') {
      alert('Veuillez choisir un fichier audio valide.');
      return;
    }

    this.selectedAudioFile = file;

    // Create a local preview URL for immediate playback
    this.selectedAudioPreviewURL = URL.createObjectURL(file);
    // ⚠️ IMPORTANT: Reset the input value so that picking the same file again re-triggers change.
    const input = document.getElementById('audioFile') as HTMLInputElement;
    if (input) {
      input.value = ''; // Clear out so a re-selection fires change
    }

    console.log('Audio file selected:', file);
  }
  onIndividualAudioFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const file = fileList[0];

    if (file.size >= 20000000) {
      alert('Le fichier audio dépasse la limite de 20MB.');
      return;
    }

    if (file.type.split('/')[0] !== 'audio') {
      alert('Veuillez choisir un fichier audio valide.');
      return;
    }

    this.individualSelectedAudioFile = file;

    if (this.individualSelectedAudioPreviewURL) {
      URL.revokeObjectURL(this.individualSelectedAudioPreviewURL);
    }
    this.individualSelectedAudioPreviewURL = URL.createObjectURL(file);

    const input = document.getElementById(
      'individualAudioFile'
    ) as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }
  onImageFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    // basic validations
    if (file.size >= 10000000) {
      alert("L'image dépasse la limite de 10MB.");
      return;
    }
    if (file.type.split('/')[0] !== 'image') {
      alert('Veuillez choisir une image (jpg, png, ...).');
      return;
    }

    this.selectedImageFile = file;
    if (this.selectedImagePreviewURL)
      URL.revokeObjectURL(this.selectedImagePreviewURL);
    this.selectedImagePreviewURL = URL.createObjectURL(file);

    // reset input so selecting the same file again triggers change
    const input = document.getElementById('imageFile') as HTMLInputElement;
    if (input) input.value = '';

    console.log('Image file selected:', file);
  }

  onIndividualImageFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    if (file.size >= 10000000) {
      alert("L'image dépasse la limite de 10MB.");
      return;
    }
    if (file.type.split('/')[0] !== 'image') {
      alert('Veuillez choisir une image (jpg, png, ...).');
      return;
    }

    this.individualSelectedImageFile = file;
    if (this.individualSelectedImagePreviewURL) {
      URL.revokeObjectURL(this.individualSelectedImagePreviewURL);
    }
    this.individualSelectedImagePreviewURL = URL.createObjectURL(file);

    const input = document.getElementById(
      'individualImageFile'
    ) as HTMLInputElement | null;
    if (input) input.value = '';
  }

  /* ---------------------- Boîte à idées helpers ---------------------- */
  toggleIdeaForm(): void {
    this.showIdeaForm = !this.showIdeaForm;
    this.showIdeaDescription = this.showIdeaForm;
  }
  toggleIdeaDescription(): void {
    this.showIdeaDescription = !this.showIdeaDescription;
    this.showIdeaForm = this.showIdeaDescription;
  }

  async startIdeaRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeTypes = [
        'audio/mp4;codecs=mp4a',
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
      ];

      let selectedMimeType = '';
      for (const mt of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
          selectedMimeType = mt;
          break;
        }
      }
      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};

      this.ideaMediaRecorder = new MediaRecorder(stream, options);
      this.ideaAudioChunks = [];

      this.ideaMediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          this.ideaAudioChunks.push(event.data);
        }
      };

      this.ideaMediaRecorder.start();
      this.ideaIsRecording = true;
      this.ideaRecordingProgress = 0;
      this.ideaElapsedTime = '00:00';
      this.startIdeaTimer();
    } catch (error) {
      console.error("Impossible d'accéder au micro :", error);
      alert('Accès au micro refusé. Vérifiez vos permissions puis réessayez.');
    }
  }

  stopIdeaRecording() {
    if (!this.ideaMediaRecorder) return;
    this.ideaMediaRecorder.stop();
    this.ideaIsRecording = false;
    this.stopIdeaTimer();

    this.ideaMediaRecorder.onstop = () => {
      this.ideaRecordedBlob = new Blob(this.ideaAudioChunks, {
        type: 'audio/webm',
      });
      this.ideaRecordedAudioURL = URL.createObjectURL(this.ideaRecordedBlob);
      this.cd.detectChanges();
    };
  }

  discardIdeaAudio() {
    if (this.ideaMediaRecorder && this.ideaMediaRecorder.state !== 'inactive') {
      this.ideaMediaRecorder.stop();
    }
    this.ideaIsRecording = false;
    this.stopIdeaTimer();

    this.ideaAudioChunks = [];
    if (this.ideaRecordedAudioURL) {
      URL.revokeObjectURL(this.ideaRecordedAudioURL);
    }
    this.ideaRecordedAudioURL = undefined;
    this.ideaRecordedBlob = undefined;

    if (this.ideaSelectedAudioPreviewURL) {
      URL.revokeObjectURL(this.ideaSelectedAudioPreviewURL);
    }
    this.ideaSelectedAudioPreviewURL = undefined;
    this.ideaSelectedAudioFile = undefined;

    const input = document.getElementById(
      'ideaAudioFile'
    ) as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }

    this.ideaElapsedTime = '00:00';
    this.ideaRecordingProgress = 0;
  }

  onIdeaAudioFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    if (file.size >= 20000000) {
      alert('Le fichier audio dépasse la limite de 20MB.');
      return;
    }
    if (file.type.split('/')[0] !== 'audio') {
      alert('Veuillez sélectionner un fichier audio valide.');
      return;
    }

    this.ideaSelectedAudioFile = file;
    if (this.ideaSelectedAudioPreviewURL) {
      URL.revokeObjectURL(this.ideaSelectedAudioPreviewURL);
    }
    this.ideaSelectedAudioPreviewURL = URL.createObjectURL(file);

    if (this.ideaRecordedAudioURL) {
      URL.revokeObjectURL(this.ideaRecordedAudioURL);
      this.ideaRecordedAudioURL = undefined;
      this.ideaRecordedBlob = undefined;
    }

    const input = document.getElementById(
      'ideaAudioFile'
    ) as HTMLInputElement | null;
    if (input) input.value = '';
  }

  onIdeaImageFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    if (file.size >= 10000000) {
      alert("L'image dépasse la limite de 10MB.");
      return;
    }
    if (file.type.split('/')[0] !== 'image') {
      alert('Veuillez sélectionner une image (jpg, png, ...).');
      return;
    }

    this.ideaSelectedImageFile = file;
    if (this.ideaSelectedImagePreviewURL) {
      URL.revokeObjectURL(this.ideaSelectedImagePreviewURL);
    }
    this.ideaSelectedImagePreviewURL = URL.createObjectURL(file);

    const input = document.getElementById(
      'ideaImageFile'
    ) as HTMLInputElement | null;
    if (input) input.value = '';
  }

  clearIdeaSelectedImage(): void {
    if (this.ideaSelectedImagePreviewURL) {
      URL.revokeObjectURL(this.ideaSelectedImagePreviewURL);
    }
    this.ideaSelectedImagePreviewURL = undefined;
    this.ideaSelectedImageFile = undefined;

    const input = document.getElementById(
      'ideaImageFile'
    ) as HTMLInputElement | null;
    if (input) input.value = '';
  }

  getIdeaLimitedProgress(): number {
    return Math.min(this.ideaRecordingProgress, 100);
  }

  private startIdeaTimer(): void {
    this.stopIdeaTimer();
    let seconds = 0;
    this.ideaRecordingTimer = setInterval(() => {
      seconds++;
      this.ideaElapsedTime = this.formatTime(seconds);
      this.ideaRecordingProgress = (seconds / 60) * 100;
    }, 1000);
  }

  private stopIdeaTimer(): void {
    if (this.ideaRecordingTimer) {
      clearInterval(this.ideaRecordingTimer);
      this.ideaRecordingTimer = undefined;
    }
  }

  async submitIdea() {
    if (this.ideaSubmissionBusy) {
      return;
    }
    if (!this.ideaEmployeeName || !this.ideaEmployeeName.trim()) {
      alert('Veuillez saisir votre nom.');
      return;
    }
    if (!this.ideaText || !this.ideaText.trim()) {
      alert('Veuillez décrire votre idée.');
      return;
    }

    this.ideaSubmissionBusy = true;
    this.ideaSubmissionSuccess = false;
    this.ideaSubmissionMessage = '';

    try {
      const [imageAttachment, audioUrl] = await Promise.all([
        this.uploadIdeaImageAttachment(),
        this.uploadIdeaAudioAsset(),
      ]);

      const payload: IdeaSubmission = {
        employeeName: this.ideaEmployeeName.trim(),
        ideaText: this.ideaText.trim(),
        createdAt: this.time.todaysDate(),
        createdAtISO: new Date().toISOString(),
        userId: this.auth.currentUser?.uid ?? null,
        ...(audioUrl ? { audioUrl } : {}),
        ...(imageAttachment ? { attachments: [imageAttachment] } : {}),
      };

      await this.auth.addIdeaSubmission(payload);
      this.ideaSubmissionSuccess = true;
      this.ideaSubmissionMessage =
        'Merci ! Votre idée a été déposée dans la Boîte à idées.';
      this.resetIdeaForm();
    } catch (error) {
      console.error("Erreur lors de l'envoi vers la Boîte à idées :", error);
      alert(
        "Impossible d'enregistrer votre idée pour le moment. Veuillez réessayer."
      );
    } finally {
      this.ideaSubmissionBusy = false;
    }
  }

  private async uploadIdeaImageAttachment(): Promise<IdeaAttachment | null> {
    if (!this.ideaSelectedImageFile) {
      return null;
    }

    const file = this.ideaSelectedImageFile;
    const path = `idea-box/images/${Date.now()}-${file.name}`;
    const uploadTask = await this.storage.upload(path, file);
    const downloadURL = await uploadTask.ref.getDownloadURL();

    return {
      type: 'image',
      url: downloadURL,
      mimeType: file.type,
      size: file.size,
    };
  }

  private async uploadIdeaAudioAsset(): Promise<string | null> {
    if (this.ideaRecordedBlob) {
      const fileName = `recorded-${Date.now()}.webm`;
      const path = `idea-box/audio/${fileName}`;
      const audioFile = new File([this.ideaRecordedBlob], fileName, {
        type: this.ideaRecordedBlob.type || 'audio/webm',
      });
      const uploadTask = await this.storage.upload(path, audioFile);
      return uploadTask.ref.getDownloadURL();
    }

    if (this.ideaSelectedAudioFile) {
      const fileName = `${Date.now()}-${this.ideaSelectedAudioFile.name}`;
      const path = `idea-box/audio/${fileName}`;
      const uploadTask = await this.storage.upload(
        path,
        this.ideaSelectedAudioFile
      );
      return uploadTask.ref.getDownloadURL();
    }

    return null;
  }

  private resetIdeaForm(): void {
    this.ideaEmployeeName = '';
    this.ideaText = '';
    this.discardIdeaAudio();
    this.clearIdeaSelectedImage();
    this.ideaElapsedTime = '00:00';
    this.ideaRecordingProgress = 0;
  }

  sendAnotherIdea(): void {
    this.ideaSubmissionSuccess = false;
    this.ideaSubmissionMessage = '';
    this.showIdeaForm = true;
    this.resetIdeaForm();
    this.showIdeaDescription = true;
  }

  goToIdeasSection(): void {
    this.ideaSubmissionSuccess = false;
    this.ideaSubmissionMessage = '';
    this.router.navigate(['/team-ranking-month'], {
      fragment: 'boite-a-idees',
    });
  }

  goToLogin(): void {
    this.ideaSubmissionSuccess = false;
    this.ideaSubmissionMessage = '';
    this.router.navigate(['/']);
  }
  addReviewWithOrWithoutAudioFile(confirmUser = true) {
    // 1) Must have a name
    if (!this.personPostingComment || !this.personPostingComment.trim()) {
      alert('Veuillez saisir votre nom.');
      return;
    }
    if (!this.numberofStars || !this.numberofStars.trim()) {
      alert('Veuillez saisir votre cote.');
      return;
    }
    if (!this.selectedTargetUserId) {
      alert('Veuillez sélectionner la localisation (utilisateur) visée.');
      return;
    }

    // 2) Check for text or audio
    const hasText = this.comment && this.comment.trim().length > 0;
    const hasRecordedAudio = !!this.recordedBlob; // if user used mic
    const hasUploadedAudio = !!this.selectedAudioFile; // if user selected a file
    const hasImage = !!this.selectedImageFile; // optional image

    if (!hasText && !hasRecordedAudio && !hasUploadedAudio && !hasImage) {
      alert(
        'Veuillez saisir un commentaire OU un fichier audio (enregistré ou téléversé).'
      );
      return;
    }

    // 3) Confirm
    if (
      confirmUser &&
      !confirm('Êtes-vous sûr de vouloir publier ce commentaire ?')
    ) {
      return;
    }

    const targetUserId = this.selectedTargetUserId!;

    // 4) If we do have audio, upload it. Priority: recorded first, else selected file. If no audio but an image exists, upload the image.
    if (hasRecordedAudio) {
      this.uploadRecordedBlobAndThenPostComment(targetUserId);
    } else if (hasUploadedAudio) {
      this.uploadSelectedFileAndThenPostComment(targetUserId);
    } else if (hasImage) {
      this.uploadImageAndThenPostComment(targetUserId);
    } else {
      // just text
      this.submitReview('team', {
        audioUrl: '',
        targetUserId,
      });
    }
  }
  addIndividualReviewWithOrWithoutAudioFile(confirmUser = true) {
    if (
      !this.individualPersonPostingComment ||
      !this.individualPersonPostingComment.trim()
    ) {
      alert('Veuillez saisir votre nom.');
      return;
    }
    if (!this.individualNumberOfStars || !this.individualNumberOfStars.trim()) {
      alert('Veuillez saisir votre cote.');
      return;
    }
    if (!this.individualSelectedTargetUserId) {
      alert("Veuillez sélectionner l'employé concerné.");
      return;
    }

    const hasText =
      this.individualComment && this.individualComment.trim().length > 0;
    const hasRecordedAudio = !!this.individualRecordedBlob;
    const hasUploadedAudio = !!this.individualSelectedAudioFile;
    const hasImage = !!this.individualSelectedImageFile;

    if (!hasText && !hasRecordedAudio && !hasUploadedAudio && !hasImage) {
      alert(
        'Veuillez saisir un commentaire, ajouter une image ou fournir un fichier audio.'
      );
      return;
    }

    if (
      confirmUser &&
      !confirm('Êtes-vous sûr de vouloir publier ce commentaire individuel ?')
    ) {
      return;
    }

    const targetUserId = this.individualSelectedTargetUserId!;

    if (hasRecordedAudio) {
      this.uploadIndividualRecordedBlobAndThenPostComment(targetUserId);
    } else if (hasUploadedAudio) {
      this.uploadIndividualSelectedFileAndThenPostComment(targetUserId);
    } else if (hasImage) {
      this.uploadIndividualImageAndThenPostComment(targetUserId);
    } else {
      this.submitReview('individual', {
        audioUrl: '',
        targetUserId,
      });
    }
  }
  deleteReview(idx: number, r: Comment) {
    if (!confirm('Supprimer définitivement ce commentaire ?')) return;

    /* ① retirer les champs d’interface */
    const { __editingPerf, __perfDraft, timeFormatted, starsNumber, ...clean } =
      r as any;

    /* ② appeler le service */
    this.auth
      .deleteReview(this.reviewId, clean)
      .then(() => {
        /* ③  synchro UI + histogramme */
        this.reviews.splice(idx, 1);
        this.buildPerformanceGraph();
        alert('Commentaire supprimé avec succès.');
      })
      .catch((err) => {
        console.error('Deletion failed:', err);
        alert('Impossible de supprimer ce commentaire.');
      });
  }

  private buildMetricsKeys(): Array<{ key: string; label: string }> {
    const map = new Map<string, string>();
    this.teamMetricDefinitions.forEach(({ key, label }) => {
      if (!map.has(key)) {
        map.set(key, label);
      }
    });
    this.individualMetricDefinitions.forEach(({ key, label }) => {
      if (!map.has(key)) {
        map.set(key, label);
      }
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }

  private buildMetricsPayload(source: MetricState[]): Record<string, number> {
    return source.reduce((acc, metric) => {
      acc[metric.key] = metric.value;
      return acc;
    }, {} as Record<string, number>);
  }

  /** ---------- 1. Injecter les metrics + visible dans le payload ---------- */
  private submitReview(
    context: 'team' | 'individual',
    {
      audioUrl,
      targetUserId,
      attachments,
    }: {
      audioUrl: string;
      targetUserId: string;
      attachments?: Array<any>;
    }
  ) {
    const isTeam = context === 'team';
    const metricsSource = isTeam ? this.metrics : this.individualMetrics;
    const nameSource = isTeam
      ? this.personPostingComment
      : this.individualPersonPostingComment;
    const commentSource = isTeam ? this.comment : this.individualComment;
    const starsSource = isTeam
      ? this.numberofStars
      : this.individualNumberOfStars;
    const performanceSource = isTeam
      ? this.auth.isAdmin && this.performanceValue > 0
        ? this.performanceValue
        : undefined
      : this.auth.isAdmin && this.individualPerformanceValue > 0
      ? this.individualPerformanceValue
      : undefined;

    const targetLabel = isTeam
      ? this.getUserLabelById(targetUserId)
      : this.getEmployeeLabelById(targetUserId);
    const metricsPayload = this.buildMetricsPayload(metricsSource);

    const review: Comment = {
      name: nameSource?.trim() ?? '',
      comment: commentSource?.trim() ?? '',
      time: this.time.todaysDate(),
      stars: (starsSource ?? '').toString(),
      audioUrl,
      visible: false,
      ...metricsPayload,
      targetUserId,
      targetUserLastName: targetLabel,
      ...(attachments && attachments.length ? { attachments } : {}),
      ...(performanceSource !== undefined
        ? { performance: performanceSource }
        : {}),
      ...(context === 'individual' ? { scope: 'individual' } : {}),
    };

    this.auth
      .addReview(review, targetUserId)
      .then(() => {
        this.previewOpen = false;
        this.previewContext = null;
        const showForCurrentUser =
          this.isAuthenticated && this.auth.currentUser?.uid === targetUserId;
        if (showForCurrentUser) {
          this.reviews.unshift(review);
          this.setReviews();
        }

        if (isTeam) {
          this.resetTeamComposerState();
          this.showForm = false;
        } else {
          this.resetIndividualComposerState();
          this.individualShowForm = false;
        }

        this.submissionTargetLabel = targetLabel;
        this.submissionSuccess = true;
        this.submissionContext = context;
      })
      .catch((err) => {
        console.error('Erreur d’enregistrement :', err);
        alert('Échec de la publication du commentaire.');
      });
  }
  /* === Aperçu === */
  showPreview(context: 'team' | 'individual') {
    if (context === 'team') {
      if (!this.personPostingComment || !this.personPostingComment.trim()) {
        alert('Veuillez saisir votre nom.');
        return;
      }
      if (!this.numberofStars || !this.numberofStars.trim()) {
        alert('Veuillez saisir votre cote.');
        return;
      }
      if (!this.selectedTargetUserId) {
        alert('Veuillez sélectionner la localisation (utilisateur) visée.');
        return;
      }
    } else {
      if (
        !this.individualPersonPostingComment ||
        !this.individualPersonPostingComment.trim()
      ) {
        alert('Veuillez saisir votre nom.');
        return;
      }
      if (
        !this.individualNumberOfStars ||
        !this.individualNumberOfStars.trim()
      ) {
        alert('Veuillez saisir votre cote.');
        return;
      }
      if (!this.individualSelectedTargetUserId) {
        alert("Veuillez sélectionner l'employé concerné.");
        return;
      }
    }
    this.previewContext = context;
    this.previewOpen = true;
  }
  /** ---------- 3. Bouton « Publier » dans le modal ---------- */
  publishComment() {
    const context = this.previewContext ?? 'team';
    this.previewOpen = false;
    // on publie sans redemander la confirmation
    if (context === 'individual') {
      this.addIndividualReviewWithOrWithoutAudioFile(false);
    } else {
      this.addReviewWithOrWithoutAudioFile(false);
    }
  }
  sendAnotherFeedback() {
    this.submissionSuccess = false;
    this.submissionTargetLabel = '';
    this.previewOpen = false;
    this.previewContext = null;
    this.resetTeamComposerState();
    this.resetIndividualComposerState();
    if (this.submissionContext === 'individual') {
      this.individualShowForm = true;
      this.individualShowCommentDescription = true;
    } else {
      this.showForm = true;
      this.showCommentDescription = true;
    }
    this.submissionContext = null;
  }

  goHome() {
    if (this.isAuthenticated) {
      this.router.navigate(['/home']);
      return;
    }
    // else{

    // }
    this.router.navigate(['/']);
  }

  /** ---------- 4. Méthodes d’affichage / filtrage ---------- */
  toggleVisibility(c: Comment) {
    c.visible = !c.visible;
    this.auth.updateReviewVisibility(this.reviewId, c);
  }

  filteredReviews() {
    return this.auth.isAdmin
      ? this.reviews
      : this.reviews.filter((r) => r.visible);
  }
  /** Nom de fichier “propre” (sans token) */
  private extractFileName(url: string): string {
    const clean = url.split('?')[0];
    return decodeURIComponent(clean.substring(clean.lastIndexOf('/') + 1));
  }

  /** Téléchargement sans fetch : <a download> + clic programmatique */
  downloadAudio(url: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = this.extractFileName(url) || `audio-${Date.now()}.webm`;
    a.target = '_blank'; // Safari/iOS : ouvre dans un onglet
    a.rel = 'noopener';
    document.body.appendChild(a); // Firefox exige que le lien soit dans le DOM
    a.click();
    document.body.removeChild(a);
  }

  private resetTeamComposerState(): void {
    this.personPostingComment = '';
    this.comment = '';
    this.numberofStars = '';
    this.metrics.forEach((m) => (m.value = 0));
    this.performanceValue = 0;
    this.commentAudioUrl = '';

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
    this.audioChunks = [];
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = undefined;
    }
    if (this.recordedAudioURL) {
      URL.revokeObjectURL(this.recordedAudioURL);
    }
    this.recordedAudioURL = undefined;
    this.recordedBlob = undefined;

    if (this.selectedAudioPreviewURL) {
      URL.revokeObjectURL(this.selectedAudioPreviewURL);
    }
    this.selectedAudioPreviewURL = undefined;
    this.selectedAudioFile = undefined;

    // image cleanup
    if (this.selectedImagePreviewURL) {
      URL.revokeObjectURL(this.selectedImagePreviewURL);
    }
    this.selectedImagePreviewURL = undefined;
    this.selectedImageFile = undefined;

    this.elapsedTime = '00:00';
    this.recordingProgress = 0;
    this.selectedTargetUserId = this.auth.currentUser?.uid ?? null;
  }

  private resetIndividualComposerState(): void {
    this.individualPersonPostingComment = '';
    this.individualComment = '';
    this.individualNumberOfStars = '';
    this.individualMetrics.forEach((m) => (m.value = 0));

    if (
      this.individualMediaRecorder &&
      this.individualMediaRecorder.state !== 'inactive'
    ) {
      this.individualMediaRecorder.stop();
    }
    this.individualIsRecording = false;
    this.individualAudioChunks = [];
    this.stopIndividualTimer();
    if (this.individualRecordedAudioURL) {
      URL.revokeObjectURL(this.individualRecordedAudioURL);
    }
    this.individualRecordedAudioURL = undefined;
    this.individualRecordedBlob = undefined;

    if (this.individualSelectedAudioPreviewURL) {
      URL.revokeObjectURL(this.individualSelectedAudioPreviewURL);
    }
    this.individualSelectedAudioPreviewURL = undefined;
    this.individualSelectedAudioFile = undefined;

    if (this.individualSelectedImagePreviewURL) {
      URL.revokeObjectURL(this.individualSelectedImagePreviewURL);
    }
    this.individualSelectedImagePreviewURL = undefined;
    this.individualSelectedImageFile = undefined;

    this.individualElapsedTime = '00:00';
    this.individualRecordingProgress = 0;
    this.individualSelectedTargetUserId = this.employeeOptions[0]?.uid ?? null;
    this.individualPerformanceValue = 0;
  }

  /** Build a cleaned copy of reviews suitable for saving to Firestore (strip UI props) */
  private buildCleanedReviews(
    updatedIndex?: number,
    updatedReview?: any
  ): Comment[] {
    const cleaned: Comment[] = (this.reviews || []).map(
      (r: any, idx: number) => {
        // remove UI-only fields
        const {
          __editingPerf,
          __perfDraft,
          __commentDraft,
          __editingComment,
          timeFormatted,
          starsNumber,
          ...rest
        } = r as any;
        return { ...(rest as Comment) } as Comment;
      }
    );

    if (
      typeof updatedIndex === 'number' &&
      updatedReview !== undefined &&
      cleaned[updatedIndex]
    ) {
      cleaned[updatedIndex] = updatedReview;
    }

    return cleaned;
  }

  /** Admin action: remove an image attachment from an existing review */
  async adminRemoveImage(idx: number, attachment: any) {
    if (!confirm("Supprimer l'image de ce commentaire ?")) return;

    try {
      const review = this.reviews[idx];
      if (!review) return;

      // Find attachment index inside the review (in case we passed the object)
      const attIdx = (review.attachments || []).findIndex(
        (a: any) => a.url === attachment.url
      );
      if (attIdx === -1) return;

      // Try to delete file from storage (best-effort)
      const url = attachment?.url;
      if (url) {
        try {
          await this.storage.storage.refFromURL(url).delete();
        } catch (err) {
          console.warn(
            'Could not delete storage file, continuing to remove reference:',
            err
          );
        }
      }

      // Build updated review object without the attachment
      const updatedReview: any = { ...(review as any) };
      const newAttachments = (updatedReview.attachments || []).slice();
      newAttachments.splice(attIdx, 1);
      if (newAttachments.length) {
        updatedReview.attachments = newAttachments;
      } else {
        delete updatedReview.attachments;
      }

      // Persist to Firestore
      const cleaned = this.buildCleanedReviews(idx, updatedReview);
      await this.auth.updateReview(this.reviewId, cleaned);

      // Update UI
      this.reviews = cleaned as any;
      this.setReviews();
      alert('Image retirée avec succès.');
    } catch (err) {
      console.error('adminRemoveImage error:', err);
      alert("Impossible de retirer l'image.");
    }
  }

  /** Trigger admin replace flow: open hidden file input and remember target */
  adminTriggerReplaceImage(reviewIndex: number, attachment: any) {
    const review = this.reviews[reviewIndex];
    if (!review) return;

    const attIdx = (review.attachments || []).findIndex(
      (a: any) => a.url === attachment.url
    );
    if (attIdx === -1) return;

    this.adminReplaceTarget = { reviewIndex, attachmentIndex: attIdx };

    // trigger a global hidden input (create or reuse)
    let input = document.getElementById(
      'adminReplaceImage'
    ) as HTMLInputElement | null;
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.id = 'adminReplaceImage';
      input.style.display = 'none';
      input.addEventListener('change', (ev: any) => {
        const files = ev.target.files as FileList;
        this.onAdminReplaceImage(files);
      });
      document.body.appendChild(input);
    }

    input.value = ''; // reset
    input.click();
  }

  /** Handler for the admin replace input */
  async onAdminReplaceImage(files: FileList | null) {
    if (!files || files.length === 0 || !this.adminReplaceTarget) return;
    const file = files[0];

    // basic validations (mirror composer)
    if (file.size >= 10000000) {
      alert("L'image dépasse la limite de 10MB.");
      this.adminReplaceTarget = null;
      return;
    }
    if (file.type.split('/')[0] !== 'image') {
      alert('Veuillez choisir une image (jpg, png, ...).');
      this.adminReplaceTarget = null;
      return;
    }

    const { reviewIndex, attachmentIndex } = this.adminReplaceTarget;
    this.adminReplaceTarget = null; // reset early

    try {
      const review = this.reviews[reviewIndex];
      if (!review) return;

      // Upload new image
      const fileName = `reviews/${
        review.targetUserId ?? this.auth.currentUser?.uid
      }-${Date.now()}-${file.name}`;
      const uploadTask = await this.storage.upload(fileName, file);
      const newUrl = await uploadTask.ref.getDownloadURL();

      // Delete old file (best-effort)
      const oldAttachment = (review.attachments || [])[attachmentIndex];
      if (oldAttachment?.url) {
        try {
          await this.storage.storage.refFromURL(oldAttachment.url).delete();
        } catch (e) {
          console.warn('Could not delete previous storage file:', e);
        }
      }

      // Replace attachment in review
      const updatedReview: any = { ...(review as any) };
      const newAttachments = (updatedReview.attachments || []).slice();
      newAttachments[attachmentIndex] = {
        type: 'image',
        url: newUrl,
        mimeType: file.type,
        size: file.size,
      };
      updatedReview.attachments = newAttachments;

      // Persist updated reviews array
      const cleaned = this.buildCleanedReviews(reviewIndex, updatedReview);
      await this.auth.updateReview(this.reviewId, cleaned);

      // Update UI
      this.reviews = cleaned as any;
      this.setReviews();
      alert('Image remplacée avec succès.');
    } catch (err) {
      console.error('onAdminReplaceImage error:', err);
      alert("Impossible de remplacer l'image.");
    }
  }

  /** Clear only the selected image (used by the small remove button) */
  clearSelectedImage(): void {
    if (this.selectedImagePreviewURL) {
      try {
        URL.revokeObjectURL(this.selectedImagePreviewURL);
      } catch (e) {
        // ignore
      }
    }
    this.selectedImagePreviewURL = undefined;
    this.selectedImageFile = undefined;

    // reset the input element so same file can be reselected later
    const input = document.getElementById('imageFile') as HTMLInputElement;
    if (input) input.value = '';
  }

  clearIndividualSelectedImage(): void {
    if (this.individualSelectedImagePreviewURL) {
      try {
        URL.revokeObjectURL(this.individualSelectedImagePreviewURL);
      } catch (e) {
        // ignore
      }
    }
    this.individualSelectedImagePreviewURL = undefined;
    this.individualSelectedImageFile = undefined;

    const input = document.getElementById(
      'individualImageFile'
    ) as HTMLInputElement;
    if (input) input.value = '';
  }

  /** Histogramme mensuel coloré – date affichée = 1 mois en arrière */
  private buildPerformanceGraph() {
    if (!this.reviews?.length) {
      this.graphPerf = { data: [], layout: {}, config: {} };
      this.latestPerformance = null;
      this.performanceDelta = null;
      return;
    }

    /* --- 1. Regrouper par mois (moyenne) --- */
    interface Bucket {
      total: number;
      count: number;
    }
    const buckets: Record<string, Bucket> = {};

    this.reviews.forEach((r) => {
      const [mm, , yyyy] = r.time!.split('-').map(Number);
      if (r.performance === undefined || r.performance === null) return; // skip
      /* ↓↓↓  recule d’un mois  ↓↓↓ */
      const d = new Date(yyyy, mm - 1); // mois réel de la review
      d.setMonth(d.getMonth() - 1); // mois précédent
      const key = d.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      }); // « juin 2025 »

      buckets[key] ??= { total: 0, count: 0 };
      buckets[key].total += Number(r.performance ?? 0);
      buckets[key].count += 1;
    });

    /* --- 2. Trier chronologiquement --- */
    const monthsFr = [
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
    const parseKey = (s: string) => {
      const [mFr, y] = s.split(' ');
      return new Date(+y, monthsFr.indexOf(mFr));
    };
    let labels = Object.keys(buckets).sort(
      (a, b) => +parseKey(a) - +parseKey(b)
    );

    /* --- 3. Moyenne par mois --- */
    let values = labels
      .map((l) => +(buckets[l].total / buckets[l].count).toFixed(1))
      .map((val) => Math.min(100, Math.max(0, val)));

    if (!values.length) {
      this.graphPerf = { data: [], layout: {}, config: {} };
      this.latestPerformance = null;
      this.performanceDelta = null;
      return;
    }

    let monthsToKeep = 0;
    if (this.selectedRange === 'max') {
      monthsToKeep = Math.min(labels.length, 12); // last year, capped to available data
    } else {
      const limitMap: Record<'3m' | '6m', number> = { '3m': 3, '6m': 6 };
      monthsToKeep = limitMap[this.selectedRange];
    }

    if (monthsToKeep > 0 && labels.length > monthsToKeep) {
      const startIndex = Math.max(labels.length - monthsToKeep, 0);
      labels = labels.slice(startIndex);
      values = values.slice(startIndex);
    }

    this.latestPerformance = values.at(-1) ?? null;
    this.performanceDelta =
      values.length > 1
        ? Number((values.at(-1)! - values.at(-2)!).toFixed(1))
        : null;

    /* --- 4. Couleur dynamique --- */
    const colors: string[] = values.map((value) =>
      this.compute.getGradientColor(value)
    );
    const trendIsDown =
      this.performanceDelta !== null && this.performanceDelta < 0;
    if (colors.length) {
      const lastColor = this.compute.getGradientColor(values.at(-1)!);
      colors[colors.length - 1] = trendIsDown ? '#dc2626' : lastColor;
    }

    /* --- 5. Plotly --- */
    this.graphPerf = {
      data: [
        {
          x: labels,
          y: values,
          type: 'bar',
          marker: {
            color: colors,
            line: { color: 'rgba(15, 23, 42, 0.08)', width: 1 },
            opacity: 0.9,
          },
          hovertemplate: '%{x}<br><b>%{y:.1f}%</b><extra></extra>',
        },
      ],
      layout: {
        title: {
          text: 'Performance moyenne par mois',
          font: { size: 18, color: '#0f172a' },
          automargin: true,
        },
        yaxis: {
          title: '%',
          range: [0, 100],
          tickmode: 'linear',
          dtick: 10,
          ticksuffix: '%',
          gridcolor: 'rgba(148, 163, 184, 0.25)',
          zerolinecolor: 'rgba(148, 163, 184, 0.35)',
          fixedrange: true,
        },
        xaxis: {
          title: '',
          tickangle: -20,
          showgrid: false,
          tickfont: { size: 12 },
        },
        height: 280,
        bargap: 0.3,
        margin: { t: 30, r: 12, l: 50, b: 60 },
        plot_bgcolor: 'rgba(255,255,255,0)',
        paper_bgcolor: 'rgba(255,255,255,0)',
      },
      config: { responsive: true, displayModeBar: false },
    };
  }

  setPerformanceRange(range: '3m' | '6m' | 'max') {
    if (this.selectedRange === range) {
      return;
    }
    this.selectedRange = range;
    this.buildPerformanceGraph();
  }

  savePerformance(c: Comment) {
    const val = Number(c.__perfDraft);
    if (isNaN(val) || val < 0 || val > 100) {
      alert('La performance doit être comprise entre 0 et 100.');
      return;
    }

    // 1. Màj locale
    c.performance = val;
    c.__editingPerf = false;

    // 2. Construire un tableau sans les champs UI
    const cleanReviews: Comment[] = this.reviews.map((r) => {
      const { __editingPerf, __perfDraft, ...rest } = r;
      return rest as Comment;
    });

    // 3. Pousser en base
    this.auth
      .updateReviewPerformance(this.reviewId, cleanReviews)
      .then(() => this.buildPerformanceGraph())
      .catch((err) => {
        console.error('Update failed:', err);
        alert('Impossible d’enregistrer la performance.');
      });
  }

  /** ---------- COMMENT inline-edit helpers ---------- */
  enableEditComment(c: Comment) {
    c.__commentDraft = c.comment ?? ''; // seed with current text
    c.__editingComment = true;
  }

  cancelEditComment(c: Comment) {
    c.__editingComment = false;
  }

  /** Save edited comment, persist whole reviews array */
  saveComment(c: Comment) {
    if (!(c.__commentDraft ?? '').trim()) {
      alert('Le commentaire ne peut pas être vide.');
      return;
    }

    /* ① local update */
    c.comment = c.__commentDraft!.trim();
    c.__editingComment = false;

    /* ② strip UI-only props & push to Firestore */
    const cleanReviews: Comment[] = this.reviews.map((r) => {
      const {
        __editingPerf,
        __perfDraft,
        __editingComment,
        __commentDraft,
        timeFormatted,
        starsNumber,
        ...rest
      } = r as any;
      return rest as Comment;
    });

    this.auth
      .updateReview(this.reviewId, cleanReviews) // ⬅️ create once in AuthService
      .catch((err) => {
        console.error('Update failed:', err);
        alert('Impossible d’enregistrer le commentaire.');
      });
  }
}
