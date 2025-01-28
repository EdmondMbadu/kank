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
      console.log('client  ', this.client);
      this.minimumPayment();
      this.client.frenchPaymentDay = this.time.translateDayInFrench(
        this.client.paymentDay!
      );
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
          console.log(' all the client cycles data', this.clientCycles);
        });
      }
    });
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

    console.log('comments sorted', this.comments);
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
      // Request mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = []; // clear any previous data

      // Collect chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
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

  addCommentWithAudio() {
    // We'll define some helper booleans
    const hasName =
      this.personPostingComment && this.personPostingComment.trim().length > 0;
    const hasTextComment = this.comment && this.comment.trim().length > 0;
    const hasAudio = !!this.recordedBlob; // true if there's a recorded audio blob

    // Always require a name
    if (!hasName) {
      alert('Veuillez renseigner votre nom.');
      return;
    }

    // If user did NOT record audio, then they must provide text
    if (!hasAudio && !hasTextComment) {
      alert('Vous devez saisir un commentaire ou enregistrer un audio.');
      return;
    }

    // Confirm
    const conf = confirm(`Êtes-vous sûr de vouloir publier ce commentaire ?`);
    if (!conf) return;

    // If we have recorded audio, upload it and then post
    if (hasAudio) {
      this.uploadRecordedAudioAndThenPostComment();
    } else {
      // Post without audio
      this.postCommentWithoutAudio();
    }
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
  cancelRecording() {
    // If actively recording, stop first
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
    this.audioChunks = [];
    this.recordedBlob = undefined;
    this.recordedAudioURL = undefined;
    console.log('Recording canceled/reset.');
  }

  // Optional: Example method to upload the recorded audio
  async uploadRecordedAudio() {
    if (!this.recordedBlob) {
      alert('No recorded audio to upload.');
      return;
    }

    // Convert the Blob to a File
    const fileName = `audio-${Date.now()}.webm`;
    const audioFile = new File([this.recordedBlob], fileName, {
      type: this.recordedBlob.type,
    });

    // Now upload the file to your Firebase (or other) storage
    // Example:
    // const path = `clients-audio/${fileName}`;
    // const uploadTask = await this.storage.upload(path, audioFile);
    // this.commentAudioUrl = await uploadTask.ref.getDownloadURL();
    // console.log('Audio uploaded. Download URL:', this.commentAudioUrl);

    alert('Audio is ready to be uploaded – implement your own logic here.');
  }

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
}
