import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Comment } from 'src/app/models/client';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

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
  }
  /* ---------- NOUVEAU : sliders ---------- */
  metrics = [
    { key: 'ponctualite', label: 'Arrive à l’heure', value: 0 },
    { key: 'proprete', label: 'La Foundation est propre', value: 0 },
    { key: 'cahier', label: 'Cahiers et carnets à jour et corrects', value: 0 },
    {
      key: 'suiviClients',
      label: 'A visité les clients ne s’étant pas présentés pour payer',
      value: 0,
    },
    {
      key: 'relationClient',
      label: 'Traite les clients avec respect et sérieux',
      value: 0,
    },
  ];

  /** liste statique pour l’affichage des barres */
  metricsKeys = this.metrics.map((m: any) => ({
    key: m.key,
    label: m.label,
  }));

  /* ---------- Aperçu ---------- */
  previewOpen = false;

  teamCode: string = '';
  isRecording = false;
  mediaRecorder!: MediaRecorder;
  audioChunks: BlobPart[] = []; // Will store the recorded audio data (chunks)
  recordedBlob?: Blob; // Final audio blob
  recordedAudioURL?: string; // Local blob URL for playback in the UI
  commentAudioUrl: string = ''; // Final upload URL from Firebase

  selectedAudioFile?: File;
  selectedAudioPreviewURL?: string; // For local preview

  elapsedTime = '00:00';
  recordingProgress = 0;
  private recordingTimer: any;
  allUsers: User[] = [];
  selectedTargetUserId: string | null = null;
  isAuthenticated = false;
  private authSub?: Subscription;
  private reviewsSub?: Subscription;
  private usersSub?: Subscription;
  submissionSuccess = false;
  submissionTargetLabel = '';

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
      this.setReviews();
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.reviewsSub?.unsubscribe();
    this.usersSub?.unsubscribe();
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
        const resolvedLabel = this.getUserLabelById(
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
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${this.pad(minutes)}:${this.pad(secs)}`;
  }
  getLimitedProgress(): number {
    return Math.min(this.recordingProgress, 100);
  }
  private getUserLabelById(userId?: string | null, fallback = ''): string {
    if (!userId) {
      return fallback;
    }
    const user = this.allUsers.find((u) => u.uid === userId);
    return user?.firstName || user?.lastName || user?.email || fallback;
  }
  getSelectedTargetLabel(): string {
    return this.getUserLabelById(this.selectedTargetUserId);
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
      this.addReview(downloadURL, targetUserId);

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
      this.addReview(downloadURL, targetUserId);

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

    if (!hasText && !hasRecordedAudio && !hasUploadedAudio) {
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

    const targetUserId = this.selectedTargetUserId;

    // 4) If we do have audio, upload it. Priority: recorded first, else selected file.
    if (hasRecordedAudio) {
      this.uploadRecordedBlobAndThenPostComment(targetUserId);
    } else if (hasUploadedAudio) {
      this.uploadSelectedFileAndThenPostComment(targetUserId);
    } else {
      // just text
      this.addReview('', targetUserId);
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

  /** ---------- 1. Injecter les metrics + visible dans le payload ---------- */
  addReview(audioUrl: string, targetUserId: string) {
    const targetLabel = this.getUserLabelById(targetUserId);
    const review: Comment = {
      name: this.personPostingComment,
      comment: this.comment,
      time: this.time.todaysDate(),
      stars: this.numberofStars,
      audioUrl,
      visible: false, // masqué par défaut
      ponctualite: this.metrics[0].value,
      proprete: this.metrics[1].value,
      cahier: this.metrics[2].value,
      suiviClients: this.metrics[3].value,
      relationClient: this.metrics[4].value,
      targetUserId,
      targetUserLastName: targetLabel,
      // ⬇️  inclure performance uniquement si admin OU valeur > 0
      ...(this.auth.isAdmin && this.performanceValue > 0
        ? { performance: this.performanceValue }
        : {}),
    };

    this.auth
      .addReview(review, targetUserId)
      .then(() => {
        this.previewOpen = false;
        const showForCurrentUser =
          this.isAuthenticated && this.auth.currentUser?.uid === targetUserId;
        if (showForCurrentUser) {
          this.reviews.unshift(review);
          this.setReviews();
        }
        this.resetComposerState();
        this.submissionTargetLabel = targetLabel;
        this.submissionSuccess = true;
        this.showForm = false;
      })
      .catch((err) => {
        console.error('Erreur d’enregistrement :', err);
        alert('Échec de la publication du commentaire.');
      });
  }
  /* === Aperçu === */
  showPreview() {
    if (!this.personPostingComment!.trim()) {
      alert('Veuillez saisir votre nom.');
      return;
    }
    this.previewOpen = true;
  }
  /** ---------- 3. Bouton « Publier » dans le modal ---------- */
  publishComment() {
    this.previewOpen = false;
    // on publie sans redemander la confirmation
    this.addReviewWithOrWithoutAudioFile(false);
  }
  sendAnotherFeedback() {
    this.submissionSuccess = false;
    this.submissionTargetLabel = '';
    this.previewOpen = false;
    this.resetComposerState();
    this.showForm = true;
  }

  goHome() {
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

  private resetComposerState(): void {
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

    this.elapsedTime = '00:00';
    this.recordingProgress = 0;
    this.selectedTargetUserId = this.auth.currentUser?.uid ?? null;
    this.previewOpen = false;
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
