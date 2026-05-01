import { Component, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Certificate } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-certificate',
  templateUrl: './certificate.component.html',
  styleUrls: ['./certificate.component.css'],
})
export class CertificateComponent implements OnInit {
  constructor(
    public auth: AuthService,
    private storage: AngularFireStorage,
    private data: DataService,
    public time: TimeService,
    private compute: ComputationService
  ) {}

  selectedBest: Certificate = {};
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
  formError = '';
  isSaving = false;

  certificate: Certificate = this.createEmptyCertificate();
  displayAddTeam: boolean = false;
  ngOnInit(): void {
    if (this.givenMonth < 0) {
      this.givenMonth = 11; // December
      this.givenYear -= 1; // Decrease the year
    }
    this.resetCertificateDraft();
    this.auth.getCertificateInfo().subscribe((data) => {
      this.best = data;
      this.certificateId = this.best[0].certificateId;
      this.certificates = (this.best[0].certificate ?? []).map(
        (item: Certificate) => this.sanitizeCertificate(item)
      );
      this.months = [
        ...new Set(this.certificates.map((item: any) => item.month)),
      ];
      this.years = [
        ...new Set(this.certificates.map((item: any) => item.year)),
      ];

      this.updateSelection();
    });
  }

  private createEmptyCertificate(): Certificate {
    return {
      month: '',
      year: '',
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

  private sanitizeText(value?: string): string {
    return value?.trim() ?? '';
  }

  private sanitizeCertificate(certificate?: Certificate): Certificate {
    return {
      month: this.sanitizeText(certificate?.month),
      year: this.sanitizeText(certificate?.year),
      bestTeam: this.sanitizeText(certificate?.bestTeam),
      bestEmployee: this.sanitizeText(certificate?.bestEmployee),
      bestEmployeePerformance: this.sanitizeText(
        certificate?.bestEmployeePerformance
      ),
      bestManager: this.sanitizeText(certificate?.bestManager),
      bestTeamCertificatePath: this.sanitizeText(
        certificate?.bestTeamCertificatePath
      ),
      bestTeamCertificateDownloadUrl: this.sanitizeText(
        certificate?.bestTeamCertificateDownloadUrl
      ),
      bestEmployeeCertificatePath: this.sanitizeText(
        certificate?.bestEmployeeCertificatePath
      ),
      bestEmployeeCertificateDownloadUrl: this.sanitizeText(
        certificate?.bestEmployeeCertificateDownloadUrl
      ),
      bestManagerCertificatePath: this.sanitizeText(
        certificate?.bestManagerCertificatePath
      ),
      bestManagerCertificateDownloadUrl: this.sanitizeText(
        certificate?.bestManagerCertificateDownloadUrl
      ),
    };
  }

  private getSelectedMonthLabel(): string {
    return this.time.monthFrenchNames[this.givenMonth] ?? '';
  }

  resetCertificateDraft(): void {
    this.certificate = this.sanitizeCertificate({
      ...this.createEmptyCertificate(),
      month: this.getSelectedMonthLabel(),
      year: this.givenYear.toString(),
    });
    this.formError = '';
  }

  openAddCertificateModal(): void {
    this.resetCertificateDraft();
    this.displayAddTeam = true;
  }

  closeAddCertificateModal(): void {
    this.displayAddTeam = false;
    this.resetCertificateDraft();
  }

  updateSelection() {
    this.selectedBest = this.selectTeamAndEmployeeByMonthAndYear(
      this.certificates,
      this.time.monthFrenchNames[this.givenMonth],
      this.givenYear.toString()
    );
    this.preposition = this.time.findPrepositionStartWithVowelOrConsonant(
      this.time.monthFrenchNames[this.givenMonth]
    );
  }

  selectTeamAndEmployeeByMonthAndYear(
    certificate: Certificate[],
    userEnteredMonth: string,
    userEnteredYear: string
  ) {
    const selectedObject = certificate.find(
      (item) => item.month === userEnteredMonth && item.year === userEnteredYear
    );
    return selectedObject!;
  }

  async startUploadCertificate(event: FileList, id: string) {
    let prefix = id.replace(/^get/, '');
    const file = event?.item(0);
    console.log(' current file data', file);
    this.formError = '';

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
  onClick(id: string) {
    const fileInput = document.getElementById(id) as HTMLInputElement;
    fileInput.click();
  }

  private validateCertificate(): string {
    if (!this.certificate.month || !this.certificate.year) {
      return 'Choisissez le mois et l’année du certificat.';
    }

    const hasBestTeam = !!this.certificate.bestTeam?.trim();
    const hasBestEmployee = !!this.certificate.bestEmployee?.trim();
    const hasBestManager = !!this.certificate.bestManager?.trim();

    if (!hasBestTeam && !hasBestEmployee && !hasBestManager) {
      return 'Entrez au moins un nom de lauréat.';
    }

    return '';
  }

  async updateData() {
    this.formError = this.validateCertificate();
    if (this.formError) {
      return;
    }

    const certificateToSave = this.sanitizeCertificate(this.certificate);
    const nextCertificates = this.certificates.map((item) =>
      this.sanitizeCertificate(item)
    );

    const existingIndex = nextCertificates.findIndex(
      (item) =>
        item.month === certificateToSave.month && item.year === certificateToSave.year
    );

    if (existingIndex >= 0) {
      nextCertificates[existingIndex] = certificateToSave;
    } else {
      nextCertificates.push(certificateToSave);
    }

    this.isSaving = true;
    try {
      await this.data.addCertificateData(nextCertificates, this.certificateId);
      this.certificates = nextCertificates;
      this.displayAddTeam = false;
      this.resetCertificateDraft();
      this.givenMonth = this.time.monthFrenchNames.indexOf(
        certificateToSave.month || ''
      );
      this.givenYear = Number(certificateToSave.year);
      this.updateSelection();
    } finally {
      this.isSaving = false;
    }
  }
  choose() {}
}
