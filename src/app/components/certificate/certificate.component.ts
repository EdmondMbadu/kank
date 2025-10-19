import { Component, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Certificate } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-certificate',
  templateUrl: './certificate.component.html',
  styleUrls: ['./certificate.component.css'],
})
export class CertificateComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    private storage: AngularFireStorage,
    private data: DataService,
    public time: TimeService
  ) {
    this.resetCertificateForm();
  }

  selectedBest?: Certificate;
  best: any = {};
  url: string = '';
  certificateId: string = '';
  certificates: Certificate[] = [];
  months?: number[] = [];

  years: string[] = [];
  // note that currentMonth and currentYear, here means the previous one
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();
  givenMonth = this.currentMonth - 1;
  givenYear = this.currentYear;
  month?: number = this.givenMonth;
  monthsList: number[] = [...Array(12).keys()];
  yearsList: number[] = this.time.yearsList;
  year = this.currentDate.getFullYear();
  preposition: string = 'De';

  certificate: Certificate = {};
  displayAddTeam: boolean = false;
  ngOnInit(): void {
    if (this.givenMonth < 0) {
      this.givenMonth = 11; // December
      this.givenYear -= 1; // Decrease the year
    }
    this.auth.getCertificateInfo().subscribe((data) => {
      this.best = data;
      this.certificateId = this.best[0].certificateId;
      this.certificates = this.best[0].certificate;
      this.months = [
        ...new Set(this.certificates.map((item: any) => item.month)),
      ];
      this.years = [
        ...new Set(this.certificates.map((item: any) => item.year)),
      ];

      this.updateSelection();
    });
  }

  toggleDisplayAddTeam() {
    if (!this.displayAddTeam) {
      this.resetCertificateForm();
    }
    this.displayAddTeam = !this.displayAddTeam;
  }

  updateSelection() {
    this.selectedBest =
      this.selectTeamAndEmployeeByMonthAndYear(
        this.certificates,
        this.time.monthFrenchNames[this.givenMonth],
        this.givenYear.toString()
      ) || undefined;
    this.preposition = this.time.findPrepositionStartWithVowelOrConsonant(
      this.time.monthFrenchNames[this.givenMonth]
    );
  }

  selectTeamAndEmployeeByMonthAndYear(
    certificate: Certificate[],
    userEnteredMonth: string,
    userEnteredYear: string
  ): Certificate | undefined {
    const selectedObject = certificate.find(
      (item) => item.month === userEnteredMonth && item.year === userEnteredYear
    );
    return selectedObject;
  }

  async startUploadCertificate(event: FileList, id: string) {
    let prefix = id.replace(/^get/, '');
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file?.type.split('/')[0] !== 'image') {
      alert('Unsupported file type. Please upload an image.');
      return;
    }

    // the size cannot be greater than 20mb
    if (file?.size >= 20000000) {
      alert(
        "L'image est trop grande. La Taille maximale du fichier est de 20MB"
      );
      return;
    }
    const path = `certificates/Best-${prefix}-${this.certificate.month}-${this.certificate.year}`;

    // the main task
    console.log('the path', path);

    const uploadTask = await this.storage.upload(path, file);

    if (id === 'getEmploye') {
      this.certificate.bestEmployeeCertificateDownloadUrl =
        await uploadTask.ref.getDownloadURL();

      this.certificate.bestEmployeeCertificatePath = path;
    } else if (id === 'getTeam') {
      this.certificate.bestTeamCertificateDownloadUrl =
        await uploadTask.ref.getDownloadURL();
      uploadTask.totalBytes;

      this.certificate.bestTeamCertificatePath = path;
    } else {
      this.certificate.bestManagerCertificateDownloadUrl =
        await uploadTask.ref.getDownloadURL();
      uploadTask.totalBytes;

      this.certificate.bestManagerCertificatePath = path;
    }
  }

  updateData() {
    this.certificate.month =
      this.time.monthFrenchNames[
        (this.givenMonth + 12) % 12
      ];
    this.certificate.year =
      this.givenMonth < 0
        ? (this.givenYear - 1).toString()
        : this.givenYear.toString();
    const nextCertificates = [...this.certificates, { ...this.certificate }];
    this.certificates = nextCertificates;
    this.data.addCertificateData(this.certificates, this.certificateId);
    this.router.navigate(['/home']);
    this.displayAddTeam = false;
    this.resetCertificateForm();
    this.updateSelection();
  }
  choose() {}

  private resetCertificateForm(): void {
    const normalizedMonthIndex = (this.givenMonth + 12) % 12;
    const normalizedYear =
      this.givenMonth < 0 ? this.givenYear - 1 : this.givenYear;
    this.certificate = {
      month: this.time.monthFrenchNames[normalizedMonthIndex],
      year: normalizedYear.toString(),
      bestTeam: '',
      bestEmployee: '',
      bestEmployeePerformance: '',
      bestTeamCertificatePath: '',
      bestTeamCertificateDownloadUrl: '',
      bestEmployeeCertificatePath: '',
      bestEmployeeCertificateDownloadUrl: '',
      bestManagerCertificatePath: '',
      bestManagerCertificateDownloadUrl: '',
    };
  }
}
