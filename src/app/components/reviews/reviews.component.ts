import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';

import { Comment } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

@Component({
  selector: 'app-reviews',
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.css'],
})
export class ReviewsComponent implements OnInit {
  personPostingComment?: string = '';
  numberofStars: string = '';
  comment?: string = '';
  reviews: Comment[] = [];
  showForm = false;

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
    // Ensure user is available before fetching reviews

    this.auth.getReviews().subscribe((data: any) => {
      this.reviews = data[0].reviews;
      this.reviewId = data[0].reviewId;
      // console.log('reviews', this.reviews);
      this.setReviews();
    });
  }

  setReviews() {
    if (this.reviews) {
      // add the formatted time
      this.reviews.forEach((comment) => {
        comment.timeFormatted = this.time.convertDateToDesiredFormat(
          comment.time!
        );
        comment.starsNumber = Number(comment.stars);
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

  private async uploadRecordedBlobAndThenPostComment() {
    try {
      // Convert Blob -> File
      const fileName = `recorded-${Date.now()}.webm`;
      const audioFile = new File([this.recordedBlob!], fileName, {
        type: this.recordedBlob!.type,
      });

      const path = `reviews/${this.auth.currentUser.uid}-${fileName}`;
      const uploadTask = await this.storage.upload(path, audioFile);
      const downloadURL = await uploadTask.ref.getDownloadURL();

      // Now finalize
      this.addReview(downloadURL);

      // Reset local fields
      this.recordedBlob = undefined;
      this.recordedAudioURL = '';
    } catch (error) {
      console.error('Error uploading recorded blob:', error);
      alert('Erreur lors du téléversement de votre enregistrement.');
    }
  }
  private async uploadSelectedFileAndThenPostComment() {
    try {
      const fileName = `upload-${Date.now()}-${this.selectedAudioFile?.name}`;
      const path = `reviews/${this.auth.currentUser.uid}-${fileName}`;

      const uploadTask = await this.storage.upload(
        path,
        this.selectedAudioFile!
      );
      const downloadURL = await uploadTask.ref.getDownloadURL();

      // Now finalize
      this.addReview(downloadURL);

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

    // 4) If we do have audio, upload it. Priority: recorded first, else selected file.
    if (hasRecordedAudio) {
      this.uploadRecordedBlobAndThenPostComment();
    } else if (hasUploadedAudio) {
      this.uploadSelectedFileAndThenPostComment();
    } else {
      // just text
      this.addReview('');
    }
    alert('Commentaire publié avec succès !');
  }
  deleteReview(index: number, review: Comment): void {
    if (!confirm('Supprimer définitivement ce commentaire ?')) {
      return;
    }

    // Remove the transient fields that were never saved in Firestore
    const { timeFormatted, starsNumber, ...original } = review as any;

    this.auth
      .deleteReview(this.reviewId, original) // <-- now matches DB
      .then(() => {
        this.reviews.splice(index, 1);
        alert('Commentaire supprimé avec succès.');
      })
      .catch((err) => {
        console.error('Deletion failed:', err);
        alert('Impossible de supprimer ce commentaire.');
      });
  }

  /** ---------- 1. Injecter les metrics + visible dans le payload ---------- */
  addReview(audioUrl: string) {
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
    };

    this.auth
      .addReview(review)
      .then(() => {
        // reset
        this.personPostingComment = '';
        this.comment = '';
        this.numberofStars = '';
        this.metrics.forEach((m) => (m.value = 5));
        this.recordedBlob = undefined;
        this.recordedAudioURL = undefined;
        this.selectedAudioFile = undefined;
        this.selectedAudioPreviewURL = undefined;
        /* ✅ confirmation à l’utilisateur */
        // alert('Commentaire publié avec succès !');
        /*  └─ remplacez par un toast/snackbar si vous en utilisez un */
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
}
