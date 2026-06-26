import { Component, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import exifr from 'exifr';
import {
  Client,
  ClientGalleryCategory,
  ClientGalleryPicture,
} from 'src/app/models/client';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';

type GalleryOwnerType = 'client' | 'card';
type GalleryOwner = Client | Card;
type GalleryFilterCategory = ClientGalleryCategory | 'all';

@Component({
  selector: 'app-client-gallery',
  templateUrl: './client-gallery.component.html',
  styleUrls: ['./client-gallery.component.css'],
})
export class ClientGalleryComponent {
  readonly categories: {
    id: ClientGalleryCategory;
    label: string;
    caption: string;
  }[] = [
    { id: 'domicile', label: 'Domicile', caption: 'Adresse et lieu de vie' },
    { id: 'trophy', label: 'Trophée', caption: 'Photos de réussite' },
    { id: 'other', label: 'Autres', caption: 'Documents visuels' },
  ];
  readonly filterCategories: {
    id: GalleryFilterCategory;
    label: string;
    caption: string;
  }[] = [
    { id: 'all', label: 'Tout', caption: 'Toutes les photos' },
    ...this.categories,
  ];

  id = '';
  ownerType: GalleryOwnerType = 'client';
  owner?: GalleryOwner;
  activeCategory: GalleryFilterCategory = 'all';
  isUploading = false;
  reclassifyingPictureId = '';
  editingCapturePictureId = '';
  captureDraftLocal = '';
  uploadCaptureLocal = '';
  uploadCaptureSource: 'exif' | 'fileLastModified' | 'manual' | '' = '';
  uploadError = '';
  selectedPicture?: ClientGalleryPicture;

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private storage: AngularFireStorage,
    private data: DataService
  ) {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.ownerType = this.route.snapshot.data['ownerType'] ?? 'client';
  }

  ngOnInit(): void {
    this.retrieveOwner();
  }

  retrieveOwner(): void {
    if (this.ownerType === 'card') {
      this.auth.getAllClientsCard().subscribe((cards: any) => {
        this.owner = cards?.[Number(this.id)];
      });
      return;
    }

    this.auth.getAllClients().subscribe((clients: any) => {
      this.owner = clients?.[Number(this.id)];
    });
  }

  get ownerName(): string {
    const parts = [
      this.owner?.firstName,
      this.owner?.middleName,
      this.owner?.lastName,
    ].filter(Boolean);
    return parts.join(' ') || 'Client';
  }

  get backLink(): string[] {
    return [
      this.ownerType === 'card' ? '/client-portal-card' : '/client-portal',
      this.id,
    ];
  }

  get ownerInitials(): string {
    const first = this.owner?.firstName?.trim()?.charAt(0) ?? '';
    const last = this.owner?.lastName?.trim()?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || 'CL';
  }

  get ownerProfilePictureUrl(): string {
    return (
      (this.owner as Client | undefined)?.profilePicture?.downloadURL?.trim() ??
      ''
    );
  }

  get ownerAddress(): string {
    return this.owner?.homeAddress || 'Adresse domicile';
  }

  get pictures(): ClientGalleryPicture[] {
    const gallery = this.owner?.galleryPictures ?? {};
    return Object.entries(gallery)
      .map(([id, picture]) => this.normalizePicture(id, picture))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  get activePictures(): ClientGalleryPicture[] {
    if (this.activeCategory === 'all') {
      return this.pictures;
    }

    return this.pictures.filter(
      (picture) => picture.category === this.activeCategory
    );
  }

  activeCategoryLabel(): string {
    return (
      this.filterCategories.find((category) => category.id === this.activeCategory)
        ?.label ?? 'Photos'
    );
  }

  countFor(categoryId: GalleryFilterCategory): number {
    if (categoryId === 'all') {
      return this.pictures.length;
    }

    return this.pictures.filter((picture) => picture.category === categoryId)
      .length;
  }

  setActiveCategory(categoryId: GalleryFilterCategory): void {
    this.activeCategory = categoryId;
  }

  get uploadCategory(): ClientGalleryCategory {
    return this.activeCategory === 'all' ? 'other' : this.activeCategory;
  }

  trackByPictureId(_index: number, picture: ClientGalleryPicture): string {
    return picture.id;
  }

  categoryLabel(categoryId: ClientGalleryCategory): string {
    return (
      this.categories.find((category) => category.id === categoryId)?.label ??
      'Photos'
    );
  }

  formatPictureDate(iso?: string): string {
    if (!iso) {
      return 'Non renseignée';
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return 'Non renseignée';
    }

    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  onUploadCaptureInput(value: string): void {
    this.uploadCaptureLocal = value;
    this.uploadCaptureSource = value ? 'manual' : '';
  }

  private normalizePicture(
    fallbackId: string,
    picture: ClientGalleryPicture
  ): ClientGalleryPicture {
    return {
      ...picture,
      id: picture.id || fallbackId,
      category: this.normalizeCategory(picture.category, picture.path),
    };
  }

  private normalizeCategory(
    category: string | undefined,
    path?: string
  ): ClientGalleryCategory {
    if (this.isGalleryCategory(category)) {
      return category;
    }

    const lowerPath = (path ?? '').toLowerCase();
    if (lowerPath.includes('/domicile/')) {
      return 'domicile';
    }
    if (lowerPath.includes('/trophy/') || lowerPath.includes('/trophee/')) {
      return 'trophy';
    }
    if (lowerPath.includes('/other/')) {
      return 'other';
    }

    return 'other';
  }

  private isGalleryCategory(
    value: string | undefined
  ): value is ClientGalleryCategory {
    return value === 'domicile' || value === 'trophy' || value === 'other';
  }

  async reclassifyPicture(
    picture: ClientGalleryPicture,
    nextCategory: ClientGalleryCategory
  ): Promise<void> {
    if (!this.isGalleryCategory(nextCategory)) {
      this.uploadError = 'Catégorie invalide.';
      return;
    }

    if (picture.category === nextCategory) {
      return;
    }

    const owner = this.owner;
    const ownerId = owner?.uid;
    if (!ownerId) {
      this.uploadError = 'Client introuvable.';
      return;
    }

    const galleryPictures = {
      ...(owner.galleryPictures ?? {}),
      [picture.id]: {
        ...picture,
        category: nextCategory,
      },
    };

    this.reclassifyingPictureId = picture.id;
    this.uploadError = '';

    try {
      if (this.ownerType === 'card') {
        await this.data.setCardField('galleryPictures', galleryPictures, ownerId);
      } else {
        await this.data.setClientField(
          'galleryPictures',
          galleryPictures,
          ownerId
        );
      }

      owner.galleryPictures = galleryPictures;
      if (this.selectedPicture?.id === picture.id) {
        this.selectedPicture = galleryPictures[picture.id];
      }
    } catch (error) {
      console.error('Erreur lors du reclassement de la photo', error);
      this.uploadError = 'Impossible de reclasser la photo. Réessayez.';
    } finally {
      this.reclassifyingPictureId = '';
    }
  }

  async uploadPicture(fileList: FileList | null): Promise<void> {
    const file = fileList?.item(0);
    if (!file) {
      return;
    }

    if (file.type.split('/')[0] !== 'image') {
      this.uploadError = 'Choisissez une image valide.';
      return;
    }

    if (file.size >= 20 * 1024 * 1024) {
      this.uploadError = "L'image est trop grande. Maximum 20MB.";
      return;
    }

    const owner = this.owner;
    const ownerId = owner?.uid;
    if (!ownerId) {
      this.uploadError = 'Client introuvable.';
      return;
    }

    this.isUploading = true;
    this.uploadError = '';

    try {
      const extractedCapture = await this.extractImageCaptureTime(file);
      if (
        this.auth.isAdmin &&
        extractedCapture.iso &&
        !this.uploadCaptureLocal
      ) {
        this.uploadCaptureLocal = this.isoToDateTimeLocal(extractedCapture.iso);
        this.uploadCaptureSource = extractedCapture.source;
      }

      const manualCaptureISO = this.dateTimeLocalToISO(this.uploadCaptureLocal);
      const captureISO = manualCaptureISO || extractedCapture.iso;
      const captureSource = manualCaptureISO
        ? this.uploadCaptureSource || 'manual'
        : extractedCapture.iso
        ? extractedCapture.source
        : undefined;
      const pictureId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const uploadCategory = this.uploadCategory;
      const path = `client-gallery/${this.ownerType}/${ownerId}/${uploadCategory}/${pictureId}-${this.cleanFileName(file.name)}`;
      const uploadTask = await this.storage.upload(path, file);
      const url = await uploadTask.ref.getDownloadURL();
      const picture: ClientGalleryPicture = {
        id: pictureId,
        category: uploadCategory,
        url,
        path,
        size: uploadTask.totalBytes || file.size,
        name: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: this.auth.currentUser?.uid,
        uploadedByName: this.auth.currentUser?.firstName,
        ...(captureISO ? { captureTimeOriginalISO: captureISO } : {}),
        ...(captureSource ? { captureTimeSource: captureSource } : {}),
      };
      const galleryPictures = {
        ...(owner.galleryPictures ?? {}),
        [pictureId]: picture,
      };

      if (this.ownerType === 'card') {
        await this.data.setCardField('galleryPictures', galleryPictures, ownerId);
      } else {
        await this.data.setClientField(
          'galleryPictures',
          galleryPictures,
          ownerId
        );
      }

      owner.galleryPictures = galleryPictures;
      this.uploadCaptureLocal = '';
      this.uploadCaptureSource = '';
      this.resetFileInput();
    } catch (error) {
      console.error("Erreur lors de l'ajout de la photo", error);
      this.uploadError = "Impossible d'ajouter la photo. Réessayez.";
    } finally {
      this.isUploading = false;
    }
  }

  openPicture(picture: ClientGalleryPicture): void {
    this.selectedPicture = picture;
  }

  closePicture(): void {
    this.selectedPicture = undefined;
  }

  startEditingCaptureTime(picture: ClientGalleryPicture): void {
    if (!this.auth.isAdmin) {
      return;
    }

    this.editingCapturePictureId = picture.id;
    this.captureDraftLocal = this.isoToDateTimeLocal(
      picture.captureTimeOriginalISO
    );
  }

  cancelEditingCaptureTime(): void {
    this.editingCapturePictureId = '';
    this.captureDraftLocal = '';
  }

  async savePictureCaptureTime(picture: ClientGalleryPicture): Promise<void> {
    if (!this.auth.isAdmin) {
      return;
    }

    const owner = this.owner;
    const ownerId = owner?.uid;
    if (!ownerId) {
      this.uploadError = 'Client introuvable.';
      return;
    }

    const captureISO = this.dateTimeLocalToISO(this.captureDraftLocal);
    const updatedPicture: ClientGalleryPicture = {
      ...picture,
    };

    if (captureISO) {
      updatedPicture.captureTimeOriginalISO = captureISO;
      updatedPicture.captureTimeSource = 'manual';
    } else {
      delete updatedPicture.captureTimeOriginalISO;
      delete updatedPicture.captureTimeSource;
    }

    const galleryPictures = {
      ...(owner.galleryPictures ?? {}),
      [picture.id]: updatedPicture,
    };

    this.uploadError = '';

    try {
      if (this.ownerType === 'card') {
        await this.data.setCardField('galleryPictures', galleryPictures, ownerId);
      } else {
        await this.data.setClientField(
          'galleryPictures',
          galleryPictures,
          ownerId
        );
      }

      owner.galleryPictures = galleryPictures;
      if (this.selectedPicture?.id === picture.id) {
        this.selectedPicture = updatedPicture;
      }
      this.cancelEditingCaptureTime();
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la date capturée', error);
      this.uploadError =
        'Impossible de mettre à jour la date capturée. Réessayez.';
    }
  }

  get selectedPictureIndex(): number {
    if (!this.selectedPicture) {
      return -1;
    }

    return this.activePictures.findIndex(
      (picture) => picture.id === this.selectedPicture?.id
    );
  }

  get canNavigateSelectedPicture(): boolean {
    return this.activePictures.length > 1;
  }

  get selectedPicturePositionLabel(): string {
    const index = this.selectedPictureIndex;
    if (index < 0) {
      return '';
    }

    return `${index + 1} / ${this.activePictures.length}`;
  }

  showPreviousPicture(event?: Event): void {
    event?.stopPropagation();
    this.moveSelectedPicture(-1);
  }

  showNextPicture(event?: Event): void {
    event?.stopPropagation();
    this.moveSelectedPicture(1);
  }

  @HostListener('document:keydown.arrowleft', ['$event'])
  onArrowLeft(event: KeyboardEvent): void {
    if (!this.selectedPicture || !this.canNavigateSelectedPicture) {
      return;
    }

    event.preventDefault();
    this.showPreviousPicture();
  }

  @HostListener('document:keydown.arrowright', ['$event'])
  onArrowRight(event: KeyboardEvent): void {
    if (!this.selectedPicture || !this.canNavigateSelectedPicture) {
      return;
    }

    event.preventDefault();
    this.showNextPicture();
  }

  private moveSelectedPicture(direction: -1 | 1): void {
    const pictures = this.activePictures;
    if (!this.selectedPicture || pictures.length <= 1) {
      return;
    }

    const currentIndex = this.selectedPictureIndex;
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      (safeIndex + direction + pictures.length) % pictures.length;
    this.selectedPicture = pictures[nextIndex];
  }

  private cleanFileName(fileName: string): string {
    return fileName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private resetFileInput(): void {
    const input = document.getElementById('galleryUpload') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }

  private async extractImageCaptureTime(
    file: File
  ): Promise<{ iso: string; source: 'exif' | 'fileLastModified' }> {
    try {
      const exif: any = await exifr.parse(file, {
        gps: false,
        tiff: true,
        exif: true,
        ifd1: false,
        xmp: true,
      });
      const rawDate =
        exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate;

      const offsetMin =
        this.parseTZOffset(exif?.OffsetTimeOriginal || exif?.OffsetTime) ??
        this.parseTimeZoneOffset(exif?.TimeZoneOffset) ??
        60;
      const exifISO = rawDate
        ? this.exifLocalToISO(rawDate, offsetMin) || this.dateLikeToISO(rawDate)
        : '';

      if (exifISO) {
        return { iso: exifISO, source: 'exif' };
      }
    } catch (error) {
      console.warn("Impossible de lire l'EXIF de la photo", error);
    }

    return {
      iso: new Date(file.lastModified).toISOString(),
      source: 'fileLastModified',
    };
  }

  private dateLikeToISO(value: unknown): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString();
  }

  private parseTZOffset(str?: string): number | undefined {
    if (!str) {
      return undefined;
    }

    const match = str.match(/^([+-])(\d{2}):?(\d{2})?$/);
    if (!match) {
      return undefined;
    }

    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = match[3] ? Number(match[3]) : 0;
    return sign * (hours * 60 + minutes);
  }

  private parseTimeZoneOffset(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return value * 60;
    }

    if (Array.isArray(value) && typeof value[0] === 'number') {
      return value[0] * 60;
    }

    return undefined;
  }

  private extractYMDHMS(value: unknown): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  } | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return {
        year: value.getFullYear(),
        month: value.getMonth() + 1,
        day: value.getDate(),
        hour: value.getHours(),
        minute: value.getMinutes(),
        second: value.getSeconds(),
      };
    }

    const match = String(value).match(
      /(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
    );
    if (!match) {
      return null;
    }

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: Number(match[6]),
    };
  }

  private exifLocalToISO(
    value: unknown,
    assumedOffsetMinutes: number
  ): string {
    const parts = this.extractYMDHMS(value);
    if (!parts) {
      return '';
    }

    const utcMs =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
      ) -
      assumedOffsetMinutes * 60 * 1000;

    return new Date(utcMs).toISOString();
  }

  private isoToDateTimeLocal(iso?: string): string {
    if (!iso) {
      return '';
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private dateTimeLocalToISO(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString();
  }
}
