import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client, Comment } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import exifr from 'exifr';
import MediaInfo from 'mediainfo.js';

type ImageAttachment = {
  type: 'image';
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  captureTimeOriginalISO?: string;
  captureTimeSource?: 'exif' | 'fileLastModified' | 'uploadTime';
  gps?: { lat: number; lng: number; alt?: number };
};

type VideoAttachment = {
  type: 'video';
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  durationSec?: number;
  captureTimeOriginalISO?: string;
  captureTimeSource?: 'mediainfo' | 'fileLastModified' | 'uploadTime';
};

type AudioMeta = {
  mimeType?: string;
  durationSec?: number;
  bitrateKbps?: number;
  captureTimeOriginalISO?: string;
  captureTimeSource?:
    | 'mediainfo'
    | 'fileLastModified'
    | 'recordTime'
    | 'uploadTime';
};

type MediaAttachment = ImageAttachment | VideoAttachment;

@Component({
  selector: 'app-client-portal',
  templateUrl: './client-portal.component.html',
  styleUrls: ['./client-portal.component.css'],
})
export class ClientPortalComponent {
  client = new Client();
  clientCycles: Client[] = [];
  minPay = '';
  employees: Employee[] = [];
  agent?: Employee = { firstName: '-' };
  url: string = '';
  personPostingComment?: string = '';
  comment?: string = '';
  comments: Comment[] = [];
  isRecording = false;
  mediaRecorder!: MediaRecorder;
  audioChunks: BlobPart[] = []; // Will store the recorded audio data (chunks)
  recordedBlob?: Blob; // Final audio blob
  recordedAudioURL?: string; // Local blob URL for playback in the UI
  commentAudioUrl: string = ''; // Final upload URL from Firebase
  agentVerifyingName: string = '';
  numberOfPaymentsMade: string = '';

  showPhoneHistory = false;
  copied?: string;

  @ViewChild('phoneHistory', { static: false }) phoneHistoryRef?: ElementRef;

  loanAmount: string = '0';
  debtLeft: string = '0';
  savings: string = '0';
  amountToPay: string = '0';
  paymentPeriodRange: string = '0';
  amountPaid: string = '0';
  creditScore: number = 0;
  isSilver: boolean = false;
  isGold: boolean = false;
  isPlatinum: boolean = false;
  isPhoneNumberCorrect: string = '';
  age: number | null = null; // ← nouveau
  dateJoined: string = '';

  isPosting = false;

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

  id: any = '';
  paymentDate = '';
  debtStart = '';
  debtEnd = '';
  savingsText: string = 'Transfer Epargne vers Paiement';

  // Image selection
  selectedImageFile?: File;
  selectedImagePreviewURL?: string;
  imageCaptureTimeISO?: string;
  imageCaptureTimeSource?: 'exif' | 'fileLastModified' | 'uploadTime';
  imageMetaWH?: { width: number; height: number } | null;
  imageGPS?: { lat: number; lng: number; alt?: number } | null;

  // Video selection
  selectedVideoFile?: File;
  selectedVideoPreviewURL?: string;
  videoCaptureTimeISO?: string;
  videoCaptureTimeSource?: 'mediainfo' | 'fileLastModified' | 'uploadTime';
  videoMeta?: { width?: number; height?: number; durationSec?: number } | null;

  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private time: TimeService,
    private data: DataService,
    private compute: ComputationService,
    private storage: AngularFireStorage,
    private cd: ChangeDetectorRef
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  selectedAudioFile?: File;
  selectedAudioPreviewURL?: string; // For local preview

  elapsedTime = '00:00';
  recordingProgress = 0;
  private recordingTimer: any;
  onAudioFileSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    // Keep your size limit (20 MB). Adjust if you want to allow bigger audio.
    if (file.size >= 20 * 1024 * 1024) {
      alert('Le fichier audio dépasse la limite de 20MB.');
      return;
    }

    // Accept files even if type is empty or non-standard (Safari/WhatsApp cases).
    // We'll validate/parse metadata later with MediaInfo.
    this.selectedAudioFile = file;

    // Local preview for immediate playback
    this.selectedAudioPreviewURL = URL.createObjectURL(file);

    // Reset input so re-selecting same file triggers change
    const input = document.getElementById(
      'audioFile'
    ) as HTMLInputElement | null;
    if (input) input.value = '';
  }

  ngOnInit(): void {
    this.retrieveClient();

    this.retrieveEmployees();
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.findAgent();
    });
  }
  findAgent() {
    for (let em of this.employees) {
      if (this.client.agent !== undefined && this.client.agent === em.uid) {
        this.agent = em;
      }
    }
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      console.log('the client', this.client);
      this.age = this.compute.computeAge(this.client.birthDate);

      this.minimumPayment();
      this.client.frenchPaymentDay = this.time.translateDayInFrench(
        this.client.paymentDay!
      );
      this.setFields();
      this.setGraphCredit();
      this.setComments();

      this.paymentDate = this.time.nextPaymentDate(this.client.dateJoined);
      this.debtStart = this.time.formatDateString(
        this.client.debtCycleStartDate
      );
      this.debtEnd = this.time.formatDateString(this.endDate());
      if (this.auth.isAdmninistrator) {
        this.data.getClientCycles(this.client.uid!).subscribe((data) => {
          this.clientCycles = data;
        });
      }
    });
  }

  setFields() {
    if (this.client.loanAmount) {
      this.loanAmount = this.client.loanAmount;
    }
    if (this.client.debtLeft) {
      this.debtLeft = this.client.debtLeft;
    }
    if (this.client.amountToPay) {
      this.amountToPay = this.client.amountToPay;
    }
    if (this.client.paymentPeriodRange) {
      this.paymentPeriodRange = this.client.paymentPeriodRange;
    }
    if (this.client.creditScore) {
      this.creditScore = Number(this.client.creditScore);
      this.determineTrophy();
    }
    if (this.client.savings) {
      this.savings = this.client.savings;
    }
    if (this.client.amountPaid) {
      this.amountPaid = this.client.amountPaid;
    }
    if (this.client.isPhoneCorrect) {
      this.isPhoneNumberCorrect = this.client.isPhoneCorrect;
    }
    if ((this, this.client.agentVerifyingName)) {
      this.agentVerifyingName = this.client.agentVerifyingName;
    }
    if (Number(this.client.debtLeft) <= 0) {
      this.savingsText = 'Retrait Epargne';
    }
    if (this.client.numberOfPaymentsMade) {
      this.numberOfPaymentsMade = this.client.numberOfPaymentsMade;
    }
    if (this.client.dateJoined) {
      this.dateJoined = this.time.formatDateForDRC(this.client.dateJoined);
    }
  }

  determineTrophy() {
    if (this.creditScore >= 100) {
      this.isPlatinum = true;
    } else if (this.creditScore >= 90) {
      this.isGold = true;
    } else if (this.creditScore >= 70) {
      this.isSilver = true;
    }
  }

  async setClientField(field: string, value: any, skip: boolean = false) {
    if (!this.compute.isNumber(value) && !skip) {
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
  isFullPictureVisible = false;

  /** Open / close the full-screen photo viewer */
  toggleFullPicture(): void {
    this.isFullPictureVisible = !this.isFullPictureVisible;
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

  endDate() {
    return Number(this.client.paymentPeriodRange) === 8
      ? this.time.getDateInNineWeeks(this.client.debtCycleStartDate!)
      : this.time.getDateInFiveWeeks(this.client.debtCycleStartDate!);
  }

  minimumPayment() {
    const pay =
      Number(this.client.amountToPay) / Number(this.client.paymentPeriodRange);
    this.minPay = pay.toString();
  }

  startNewDebtCycle() {
    if (
      this.client.amountPaid?.toString() !== this.client.amountToPay?.toString()
    ) {
      alert(
        `Vous devez encore FC ${this.client.debtLeft}. Terminez d'abord ce cycle.`
      );
      return;
    } else {
      this.router.navigate(['/new-cycle-register/' + this.id]);
    }
  }
  withDrawFromSavings() {
    if (this.client.savings === '0') {
      alert("Vous n'avez pas d'argent d'epargnes!");
      return;
    } else {
      this.router.navigate(['/withdraw-savings/' + this.id]);
    }
  }
  requestWithDrawFromSavings() {
    if (this.client.savings?.toString() === '0') {
      alert("Vous n'avez pas d'argent d'epargnes!");
      return;
    } else if (Number(this.client.debtLeft) > 0) {
      alert(
        'Vous devez d’abord finir votre dette avant de demander votre épargne!'
      );
      return;
    } else {
      this.router.navigate(['/request-savings-withdraw/' + this.id]);
    }
  }

  delete() {
    let result = confirm('Êtes-vous sûr de vouloir supprimer ce client?');
    if (!result) {
      return;
    }
    this.auth
      .deleteClient(this.client)
      .then(() => {
        alert('Client supprimé avec succès !');
        this.router.navigate(['/client-info/']);
      })
      .catch((error) => {
        alert('Error deleting client: ');
      });

    this.auth
      .UpdateUserInfoForDeletedClient(this.client)
      .then(() => {
        console.log('updated user info');
      })
      .catch((error) => {
        alert('Error deleting client: ');
      });
    this.removeClientFromAgentList();
  }

  removeClientFromAgentList() {
    this.agent!.clients = this.agent?.clients?.filter(
      (element) => element !== this.client.uid
    );

    this.data
      .updateEmployeeInfoForClientAgentAssignment(this.agent!)
      .then(() => console.log('agent clients list updated succesfully.'));
  }
  async startUpload(event: FileList) {
    // console.log('current employee', this.client);
    const file = event?.item(0);
    // console.log(' current file data', file);

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

  // Helper: Upload the audio if it exists, then post comment

  async uploadRecordedAudioAndThenPostComment() {
    try {
      // 1) Convert blob to File, upload to Firebase
      const fileName = `audio-${Date.now()}.webm`;
      const audioFile = new File([this.recordedBlob!], fileName, {
        type: this.recordedBlob!.type,
      });

      const path = `clients-audio/${this.client.uid}-${fileName}`;
      const uploadTask = await this.storage.upload(path, audioFile);
      this.commentAudioUrl = await uploadTask.ref.getDownloadURL();

      // 2) Now finalize posting the comment with the audio URL
      this.finalizeCommentPost(this.commentAudioUrl);
    } catch (error) {
      console.error('Error uploading recorded audio:', error);
      alert('Error uploading audio. Please try again.');
    }
  }

  postCommentWithoutAudio() {
    this.finalizeCommentPost('');
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

  // Optional: Example method to upload the recorded audio

  finalizeCommentPost(audioUrl: string) {
    const newComment: Comment = {
      name: this.personPostingComment,
      comment: this.comment,
      time: this.time.todaysDate(), // or new Date().toISOString()
      audioUrl: audioUrl,
    };

    // Add to local array (so it displays immediately)
    this.comments.push(newComment);

    // Update in Firestore
    this.data
      .addCommentToClientProfile(this.client, this.comments)
      .then(() => {
        this.personPostingComment = '';
        this.comment = '';
        this.commentAudioUrl = '';
        this.recordedBlob = undefined;
        this.recordedAudioURL = '';
        alert('Comment posted successfully!');
      })
      .catch((err) => {
        console.error(err);
        alert('Error posting comment.');
      });
  }

  // addCommentWithAudioFile() {
  //   // 1) Must have a name
  //   if (!this.personPostingComment || !this.personPostingComment.trim()) {
  //     alert('Veuillez saisir votre nom.');
  //     return;
  //   }

  //   // 2) Check for text or audio
  //   const hasText = this.comment && this.comment.trim().length > 0;
  //   const hasRecordedAudio = !!this.recordedBlob; // if user used mic
  //   const hasUploadedAudio = !!this.selectedAudioFile; // if user selected a file

  //   if (!hasText && !hasRecordedAudio && !hasUploadedAudio) {
  //     alert(
  //       'Veuillez saisir un commentaire OU un fichier audio (enregistré ou téléversé).'
  //     );
  //     return;
  //   }

  //   // 3) Confirm
  //   if (!confirm('Êtes-vous sûr de vouloir publier ce commentaire ?')) {
  //     return;
  //   }

  //   // 4) If we do have audio, upload it. Priority: recorded first, else selected file.
  //   if (hasRecordedAudio) {
  //     this.uploadRecordedBlobAndThenPostComment();
  //   } else if (hasUploadedAudio) {
  //     this.uploadSelectedFileAndThenPostComment();
  //   } else {
  //     // just text
  //     this.postCommentToFirestore('');
  //   }
  // }

  // Keep backward compatibility with your template call if needed:
  addCommentWithAudioFile() {
    this.addCommentWithMedia();
  }

  async addCommentWithMedia() {
    // 1) validate author name
    if (!this.personPostingComment || !this.personPostingComment.trim()) {
      alert('Veuillez saisir votre nom.');
      return;
    }

    const hasText = this.comment && this.comment.trim().length > 0;
    const hasRecordedAudio = !!this.recordedBlob;
    const hasUploadedAudio = !!this.selectedAudioFile;
    const hasImage = !!this.selectedImageFile;
    const hasVideo = !!this.selectedVideoFile;

    if (
      !hasText &&
      !hasRecordedAudio &&
      !hasUploadedAudio &&
      !hasImage &&
      !hasVideo
    ) {
      alert('Ajoutez un texte, un audio, une image ou une vidéo.');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir publier ce commentaire ?')) return;
    this.isPosting = true;
    try {
      // 2) Upload audio if present
      let audio: { url: string; meta: AudioMeta } | null = null;
      if (hasRecordedAudio) {
        audio = await this.uploadRecordedBlobReturnUrl();
      } else if (hasUploadedAudio) {
        audio = await this.uploadSelectedAudioFileReturnUrl();
      }

      // 3) Upload media (image/video) in parallel
      const [imgAtt, vidAtt] = await Promise.all([
        this.uploadImageForComment(),
        this.uploadVideoForComment(),
      ]);
      const attachments: MediaAttachment[] = [imgAtt, vidAtt].filter(
        (x): x is MediaAttachment => x !== null
      );

      // 4) Post to Firestore with attachments + audio (+audio meta)
      this.postCommentToFirestoreWithAttachments(audio, attachments);

      // 5) Reset local UI state
      this.clearSelectedImage();
      this.clearSelectedVideo();
      this.discardAudio();
    } catch (e) {
      console.error(e);
      alert('Erreur lors de l’envoi des pièces jointes.');
    } finally {
      this.isPosting = false;
      this.cd.detectChanges();
    }
  }

  // Recorded audio -> return URL + meta with capture time = now
  private async uploadRecordedBlobReturnUrl(): Promise<{
    url: string;
    meta: AudioMeta;
  }> {
    const fileName = `recorded-${Date.now()}.webm`;
    const mimeType = this.recordedBlob?.type || 'audio/webm';
    const durationSec = this.recordedBlob
      ? await this.getAudioDurationFromBlob(this.recordedBlob)
      : undefined;

    const audioFile = new File([this.recordedBlob!], fileName, {
      type: mimeType,
    });

    const meta: AudioMeta = {
      mimeType,
      durationSec,
      captureTimeOriginalISO: new Date().toISOString(),
      captureTimeSource: 'recordTime',
    };

    const path = `clients-audio/${this.client.uid}-${fileName}`;
    const uploadTask = await this.storage.upload(path, audioFile, {
      customMetadata: {
        captureTimeOriginalISO: meta.captureTimeOriginalISO!,
        captureTimeSource: meta.captureTimeSource!,
        durationSec: (meta.durationSec ?? '').toString(),
        mimeType: mimeType,
      },
      contentType: mimeType,
    });
    const url = await uploadTask.ref.getDownloadURL();
    return { url, meta };
  }

  // Uploaded audio file -> return URL + meta read via MediaInfo (fallback to lastModified)
  private async uploadSelectedAudioFileReturnUrl(): Promise<{
    url: string;
    meta: AudioMeta;
  }> {
    const file = this.selectedAudioFile!;
    const fileName = `upload-${Date.now()}-${file.name}`;
    const path = `clients-audio/${this.client.uid}-${fileName}`;

    const meta = await this.analyzeAudioFile(file);

    const uploadTask = await this.storage.upload(path, file, {
      customMetadata: {
        captureTimeOriginalISO:
          meta.captureTimeOriginalISO || new Date().toISOString(),
        captureTimeSource: meta.captureTimeSource || 'uploadTime',
        durationSec: (meta.durationSec ?? '').toString(),
        bitrateKbps: (meta.bitrateKbps ?? '').toString(),
        mimeType: meta.mimeType || '',
      },
      contentType: file.type || undefined,
    });
    const url = await uploadTask.ref.getDownloadURL();
    return { url, meta };
  }

  private postCommentToFirestoreWithAttachments(
    audio: { url: string; meta?: AudioMeta } | null,
    attachments: MediaAttachment[]
  ) {
    const newComment: any = {
      name: this.personPostingComment!,
      time: this.time.todaysDate(),
      ...(this.comment && this.comment.trim()
        ? { comment: this.comment.trim() }
        : {}),
      ...(audio?.url ? { audioUrl: audio.url } : {}),
      ...(audio?.meta ? { audioMeta: audio.meta } : {}),
      ...(attachments.length ? { attachments } : {}),
    };

    const updated = [...this.comments, newComment];
    const sanitized = this.stripUndefinedDeep(updated);

    this.comments = sanitized;
    this.data
      .addCommentToClientProfile(this.client, sanitized)
      .then(() => {
        this.personPostingComment = '';
        this.comment = '';
        alert('Commentaire publié avec succès !');
      })
      .catch((error) => {
        console.error(error);
        alert('Erreur lors de la publication du commentaire.');
      });
  }

  private async uploadRecordedBlobAndThenPostComment() {
    try {
      // Convert Blob -> File
      const fileName = `recorded-${Date.now()}.webm`;
      const audioFile = new File([this.recordedBlob!], fileName, {
        type: this.recordedBlob!.type,
      });

      const path = `clients-audio/${this.client.uid}-${fileName}`;
      const uploadTask = await this.storage.upload(path, audioFile);
      const downloadURL = await uploadTask.ref.getDownloadURL();

      // Now finalize
      this.postCommentToFirestore(downloadURL);

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
      const path = `clients-audio/${this.client.uid}-${fileName}`;

      const uploadTask = await this.storage.upload(
        path,
        this.selectedAudioFile!
      );
      const downloadURL = await uploadTask.ref.getDownloadURL();

      // Now finalize
      this.postCommentToFirestore(downloadURL);

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

  private postCommentToFirestore(audioUrl: string) {
    const newComment: any = {
      name: this.personPostingComment!,
      time: this.time.todaysDate(),
      ...(this.comment && this.comment.trim()
        ? { comment: this.comment.trim() }
        : {}),
      ...(audioUrl ? { audioUrl } : {}),
    };

    const updated = [...this.comments, newComment];
    const sanitized = this.stripUndefinedDeep(updated);

    this.comments = sanitized;

    this.data
      .addCommentToClientProfile(this.client, sanitized)
      .then(() => {
        this.personPostingComment = '';
        this.comment = '';
        alert('Commentaire publié avec succès!');
      })
      .catch((error) => {
        console.error(error);
        alert('Erreur lors de la publication du commentaire.');
      });
  }

  formatISOToDRC(iso?: string): string {
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
      // Build "dd/MM/yyyy HH:mm:ss"
      const parts = fmt.formatToParts(d).reduce((acc: any, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});
      return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
    } catch {
      return iso!;
    }
  }

  /** Parse "+01:00" / "-07:00" -> minutes offset */
  private parseTZOffset(str?: string): number | undefined {
    if (!str) return undefined;
    const m = str.match(/^([+-])(\d{2}):?(\d{2})?$/);
    if (!m) return undefined;
    const sign = m[1] === '-' ? -1 : 1;
    const hh = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (hh * 60 + mm);
  }

  /** Extract Y/M/D/h/m/s from a Date or EXIF-like string "YYYY:MM:DD HH:mm:ss" */
  private extractYMDHMS(dt: any): {
    Y: number;
    M: number;
    D: number;
    h: number;
    mi: number;
    s: number;
  } | null {
    if (!dt) return null;
    if (dt instanceof Date) {
      return {
        Y: dt.getFullYear(),
        M: dt.getMonth() + 1,
        D: dt.getDate(),
        h: dt.getHours(),
        mi: dt.getMinutes(),
        s: dt.getSeconds(),
      };
    }
    const m = String(dt).match(
      /(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
    );
    if (!m) return null;
    const [, Y, M, D, h, mi, s] = m.map(Number);
    return { Y, M, D, h, mi, s };
  }

  /**
   * Convert an EXIF local time (no tz) to a true ISO by assuming it was taken
   * in a given timezone. Default: Africa/Kinshasa (UTC+1, no DST).
   */
  private exifLocalToISO(
    dt: any,
    assumedOffsetMinutes = 60
  ): string | undefined {
    const parts = this.extractYMDHMS(dt);
    if (!parts) return undefined;
    const { Y, M, D, h, mi, s } = parts;
    // EXIF local time -> UTC instant = local - offset
    const utcMs =
      Date.UTC(Y, M - 1, D, h, mi, s) - assumedOffsetMinutes * 60 * 1000;
    return new Date(utcMs).toISOString();
  }

  private toISO(d: Date | string | undefined | null): string | undefined {
    if (!d) return undefined;
    if (d instanceof Date) return d.toISOString();
    const maybe = new Date(d);
    return isNaN(maybe.getTime()) ? undefined : maybe.toISOString();
  }

  async onImageSelected(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];

    if (file.size > 10 * 1024 * 1024) {
      // 10 MB
      alert("L'image dépasse 10MB.");
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Veuillez choisir un fichier image.');
      return;
    }

    this.selectedImageFile = file;
    this.selectedImagePreviewURL = URL.createObjectURL(file);
    this.imageMetaWH = null;
    this.imageGPS = null;
    this.imageCaptureTimeISO = undefined;
    this.imageCaptureTimeSource = undefined;

    // Read width/height quickly
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.imageMetaWH = { width: img.width, height: img.height };
        resolve();
      };
      img.src = this.selectedImagePreviewURL!;
    });

    // Extract EXIF (DateTimeOriginal, GPS)
    try {
      const exif: any = await exifr.parse(file, {
        gps: true,
        tiff: true,
        exif: true,
        ifd1: false,
        xmp: true,
      });

      const dt = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate;

      // Prefer embedded offset if present; else assume Kinshasa (+01:00 = 60 min)
      let offsetMin = this.parseTZOffset(
        exif?.OffsetTimeOriginal || exif?.OffsetTime
      );
      // Some cameras store TimeZoneOffset as number or array of hours
      if (offsetMin == null) {
        const tzo: any = exif?.TimeZoneOffset;
        if (typeof tzo === 'number') offsetMin = tzo * 60;
        else if (Array.isArray(tzo) && typeof tzo[0] === 'number')
          offsetMin = tzo[0] * 60;
      }
      if (offsetMin == null) offsetMin = 60; // default Africa/Kinshasa

      let iso: string | undefined;
      if (dt) iso = this.exifLocalToISO(dt, offsetMin);

      if (iso) {
        this.imageCaptureTimeISO = iso;
        this.imageCaptureTimeSource = 'exif';
      } else {
        // fallback: file last modified (as UTC ISO)
        this.imageCaptureTimeISO = new Date(file.lastModified).toISOString();
        this.imageCaptureTimeSource = 'fileLastModified';
      }

      if (
        typeof exif?.latitude === 'number' &&
        typeof exif?.longitude === 'number'
      ) {
        this.imageGPS = {
          lat: exif.latitude,
          lng: exif.longitude,
          alt: exif.altitude,
        };
      }
    } catch {
      // EXIF stripped; fallback
      this.imageCaptureTimeISO = new Date(file.lastModified).toISOString();
      this.imageCaptureTimeSource = 'fileLastModified';
    }

    // reset input so picking the same file later triggers change
    const input = document.getElementById('imageFile') as HTMLInputElement;
    if (input) input.value = '';
  }

  clearSelectedImage() {
    if (this.selectedImagePreviewURL)
      URL.revokeObjectURL(this.selectedImagePreviewURL);
    this.selectedImageFile = undefined;
    this.selectedImagePreviewURL = undefined;
    this.imageCaptureTimeISO = undefined;
    this.imageCaptureTimeSource = undefined;
    this.imageMetaWH = null;
    this.imageGPS = null;
  }

  async onVideoSelected(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];

    if (file.size > 100 * 1024 * 1024) {
      // 100 MB
      alert('La vidéo dépasse 100MB.');
      return;
    }
    if (!file.type.startsWith('video/')) {
      alert('Veuillez choisir un fichier vidéo.');
      return;
    }

    this.selectedVideoFile = file;
    this.selectedVideoPreviewURL = URL.createObjectURL(file);
    this.videoMeta = {};

    // MediaInfo (heavy-ish, but client-side)
    try {
      const mediaInfo = await MediaInfo({ format: 'object' });

      const getSize = () => file.size;
      const readChunk = (size: number, offset: number) =>
        new Promise<Uint8Array>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(new Uint8Array(reader.result as ArrayBuffer));
          reader.readAsArrayBuffer(file.slice(offset, offset + size));
        });

      const res: any = await mediaInfo.analyzeData(getSize, readChunk);
      const tracks: any[] = res?.media?.track || [];
      const general =
        tracks.find((t) => (t['@type'] || t.Type) === 'General') || {};
      const videoTrack =
        tracks.find((t) => (t['@type'] || t.Type) === 'Video') || {};

      // Dates come like "UTC 2024-06-30 14:22:10"
      const rawDate: string | undefined =
        general.Encoded_Date ||
        general.Tagged_Date ||
        general.Mastered_Date ||
        general.File_Last_Modified_Date;

      const parseUtcLike = (s?: string): string | undefined => {
        if (!s) return undefined;
        const m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
        if (!m) return undefined;
        const [_, Y, M, D, h, m2, s2] = m.map(Number);
        return new Date(Date.UTC(Y, M - 1, D, h, m2, s2)).toISOString();
      };

      const isoMaybe = parseUtcLike(rawDate);
      if (isoMaybe) {
        this.videoCaptureTimeISO = isoMaybe;
        this.videoCaptureTimeSource = 'mediainfo';
      } else {
        this.videoCaptureTimeISO = new Date(file.lastModified).toISOString();
        this.videoCaptureTimeSource = 'fileLastModified';
      }

      // Dimensions / duration
      const width = Number(videoTrack?.Width) || undefined;
      const height = Number(videoTrack?.Height) || undefined;
      // MediaInfo duration often ms
      const durationMs =
        Number(general?.Duration) || Number(videoTrack?.Duration) || undefined;
      const durationSec =
        typeof durationMs === 'number' && !isNaN(durationMs)
          ? Math.round(durationMs / 1000)
          : undefined;

      this.videoMeta = { width, height, durationSec };
    } catch {
      // fallback
      this.videoCaptureTimeISO = new Date(file.lastModified).toISOString();
      this.videoCaptureTimeSource = 'fileLastModified';
      this.videoMeta = {};
    }

    // reset input
    const input = document.getElementById('videoFile') as HTMLInputElement;
    if (input) input.value = '';
  }

  clearSelectedVideo() {
    if (this.selectedVideoPreviewURL)
      URL.revokeObjectURL(this.selectedVideoPreviewURL);
    this.selectedVideoFile = undefined;
    this.selectedVideoPreviewURL = undefined;
    this.videoCaptureTimeISO = undefined;
    this.videoCaptureTimeSource = undefined;
    this.videoMeta = null;
  }
  private async uploadImageForComment(): Promise<ImageAttachment | null> {
    if (!this.selectedImageFile) return null;

    const file = this.selectedImageFile;
    const captureISO = this.imageCaptureTimeISO || new Date().toISOString();
    const captureSrc = this.imageCaptureTimeSource || 'uploadTime';

    const path = `clients-media/images/${this.client.uid}-${Date.now()}-${
      file.name
    }`;
    const metadata = {
      contentType: file.type,
      customMetadata: {
        captureTimeOriginalISO: captureISO,
        captureTimeSource: captureSrc,
        width: this.imageMetaWH?.width?.toString() || '',
        height: this.imageMetaWH?.height?.toString() || '',
        gps_lat: this.imageGPS?.lat?.toString() || '',
        gps_lng: this.imageGPS?.lng?.toString() || '',
        gps_alt: this.imageGPS?.alt?.toString() || '',
      },
    };

    const uploadTask = await this.storage.upload(path, file, metadata);
    const url = await uploadTask.ref.getDownloadURL();

    const att: ImageAttachment = {
      type: 'image',
      url,
      mimeType: file.type,
      size: file.size,
      ...(this.imageMetaWH?.width !== undefined
        ? { width: this.imageMetaWH.width }
        : {}),
      ...(this.imageMetaWH?.height !== undefined
        ? { height: this.imageMetaWH.height }
        : {}),
      ...(captureISO ? { captureTimeOriginalISO: captureISO } : {}),
      ...(captureSrc ? { captureTimeSource: captureSrc } : {}),
      ...(this.imageGPS
        ? {
            gps: {
              lat: this.imageGPS.lat,
              lng: this.imageGPS.lng,
              ...(this.imageGPS.alt !== undefined
                ? { alt: this.imageGPS.alt }
                : {}),
            },
          }
        : {}),
    };

    return att;
  }

  private async uploadVideoForComment(): Promise<VideoAttachment | null> {
    if (!this.selectedVideoFile) return null;

    const file = this.selectedVideoFile;
    const captureISO = this.videoCaptureTimeISO || new Date().toISOString();
    const captureSrc = this.videoCaptureTimeSource || 'uploadTime';

    const path = `clients-media/videos/${this.client.uid}-${Date.now()}-${
      file.name
    }`;
    const metadata = {
      contentType: file.type,
      customMetadata: {
        captureTimeOriginalISO: captureISO,
        captureTimeSource: captureSrc,
        width: this.videoMeta?.width?.toString() || '',
        height: this.videoMeta?.height?.toString() || '',
        durationSec: this.videoMeta?.durationSec?.toString() || '',
      },
    };

    const uploadTask = await this.storage.upload(path, file, metadata);
    const url = await uploadTask.ref.getDownloadURL();

    const att: VideoAttachment = {
      type: 'video',
      url,
      mimeType: file.type,
      size: file.size,
      ...(this.videoMeta?.width !== undefined
        ? { width: this.videoMeta.width }
        : {}),
      ...(this.videoMeta?.height !== undefined
        ? { height: this.videoMeta.height }
        : {}),
      ...(this.videoMeta?.durationSec !== undefined
        ? { durationSec: this.videoMeta.durationSec }
        : {}),
      ...(captureISO ? { captureTimeOriginalISO: captureISO } : {}),
      ...(captureSrc ? { captureTimeSource: captureSrc } : {}),
    };

    return att;
  }

  private stripUndefinedDeep<T>(value: T): T {
    if (Array.isArray(value)) {
      return value
        .map((v) => this.stripUndefinedDeep(v))
        .filter((v) => v !== undefined) as unknown as T;
    }
    if (value && typeof value === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(value as any)) {
        if (v === undefined) continue;
        out[k] = this.stripUndefinedDeep(v as any);
      }
      return out;
    }
    return value;
  }

  /** Re-usable parser for "UTC 2024-06-30 14:22:10" like strings from MediaInfo */
  private parseUtcLike(s?: string): string | undefined {
    if (!s) return undefined;
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return undefined;
    const [_, Y, M, D, h, m2, s2] = m.map(Number);
    return new Date(Date.UTC(Y, M - 1, D, h, m2, s2)).toISOString();
  }

  /** Decode duration using Web Audio API when we have a Blob (for recordings) */
  private async getAudioDurationFromBlob(
    blob: Blob
  ): Promise<number | undefined> {
    try {
      const arrayBuf = await blob.arrayBuffer();
      const audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
      return Math.round(decoded.duration);
    } catch {
      return undefined;
    }
  }

  /** Read audio metadata (duration/bitrate/capture date) using mediainfo.js */
  private async analyzeAudioFile(file: File): Promise<AudioMeta> {
    try {
      const mediaInfo = await MediaInfo({ format: 'object' });
      const getSize = () => file.size;
      const readChunk = (size: number, offset: number) =>
        new Promise<Uint8Array>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(new Uint8Array(reader.result as ArrayBuffer));
          reader.readAsArrayBuffer(file.slice(offset, offset + size));
        });

      const res: any = await mediaInfo.analyzeData(getSize, readChunk);
      const tracks: any[] = res?.media?.track || [];
      const general =
        tracks.find((t) => (t['@type'] || t.Type) === 'General') || {};
      const audio =
        tracks.find((t) => (t['@type'] || t.Type) === 'Audio') || {};

      const rawDate: string | undefined =
        general.Encoded_Date ||
        general.Tagged_Date ||
        general.Mastered_Date ||
        general.File_Last_Modified_Date;

      const captureISO =
        this.parseUtcLike(rawDate) || new Date(file.lastModified).toISOString();

      const durationMs = Number(general.Duration) || Number(audio.Duration);
      const durationSec = Number.isFinite(durationMs)
        ? Math.round(durationMs / 1000)
        : undefined;

      const bitrate = Number(audio.BitRate) || Number(general.OverallBitRate);
      const bitrateKbps = Number.isFinite(bitrate)
        ? Math.round(bitrate / 1000)
        : undefined;

      return {
        mimeType: file.type || undefined,
        durationSec,
        bitrateKbps,
        captureTimeOriginalISO: captureISO,
        captureTimeSource: this.parseUtcLike(rawDate)
          ? 'mediainfo'
          : 'fileLastModified',
      };
    } catch {
      // Fall back to file modified time only
      return {
        mimeType: file.type || undefined,
        captureTimeOriginalISO: new Date(file.lastModified).toISOString(),
        captureTimeSource: 'fileLastModified',
      };
    }
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
}
