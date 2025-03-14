import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client, Comment } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';

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

  loanAmount: string = '0';
  debtLeft: string = '0';
  savings: string = '0';
  amountToPay: string = '0';
  paymentPeriodRange: string = '0';
  creditScore: number = 0;
  isSilver: boolean = false;
  isGold: boolean = false;
  isPlatinum: boolean = false;

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
    if (this.client.amountPaid !== this.client.amountToPay) {
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
    if (this.client.savings === '0') {
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

  addCommentWithAudioFile() {
    // 1) Must have a name
    if (!this.personPostingComment || !this.personPostingComment.trim()) {
      alert('Veuillez saisir votre nom.');
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
    if (!confirm('Êtes-vous sûr de vouloir publier ce commentaire ?')) {
      return;
    }

    // 4) If we do have audio, upload it. Priority: recorded first, else selected file.
    if (hasRecordedAudio) {
      this.uploadRecordedBlobAndThenPostComment();
    } else if (hasUploadedAudio) {
      this.uploadSelectedFileAndThenPostComment();
    } else {
      // just text
      this.postCommentToFirestore('');
    }
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
    const newComment: Comment = {
      name: this.personPostingComment,
      comment: this.comment,
      time: this.time.todaysDate(),
      audioUrl: audioUrl, // could be '' if none
    };

    // Add locally
    this.comments.push(newComment);

    // Save to Firestore
    this.data
      .addCommentToClientProfile(this.client, this.comments)
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
}
