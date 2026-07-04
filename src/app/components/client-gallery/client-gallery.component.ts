import { Component, HostListener, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { firstValueFrom } from 'rxjs';
import exifr from 'exifr';
import {
  Client,
  ClientGalleryCategory,
  ClientGalleryMediaType,
  ClientGalleryPicture,
} from 'src/app/models/client';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

type GalleryOwnerType = 'client' | 'card' | 'trophy';
type GalleryOwner = Client | Card;
type GalleryFilterCategory = ClientGalleryCategory | 'all';
type TrophyGalleryAwardFilter = 'all' | 'team' | 'employee' | 'manager';

@Component({
  selector: 'app-client-gallery',
  templateUrl: './client-gallery.component.html',
  styleUrls: ['./client-gallery.component.css'],
})
export class ClientGalleryComponent implements OnDestroy {
  private readonly systemHomePictureId = '__home-picture';
  readonly categories: {
    id: ClientGalleryCategory;
    label: string;
    caption: string;
  }[] = [
    { id: 'domicile', label: 'Domicile', caption: 'Adresse et lieu de vie' },
    { id: 'trophy', label: 'Trophée', caption: 'Médias de réussite' },
    { id: 'other', label: 'Autres', caption: 'Documents visuels' },
  ];
  readonly filterCategories: {
    id: GalleryFilterCategory;
    label: string;
    caption: string;
  }[] = [
    { id: 'all', label: 'Tout', caption: 'Tous les médias' },
    ...this.categories,
  ];

  id = '';
  ownerType: GalleryOwnerType = 'client';
  owner?: GalleryOwner;
  activeCategory: GalleryFilterCategory = 'all';
  isUploading = false;
  isPreparingUpload = false;
  pendingUploadFile?: File;
  pendingUploadPreviewUrl = '';
  pendingUploadCategory: ClientGalleryCategory = 'other';
  pendingExtractedCaptureISO = '';
  pendingExtractedCaptureSource: 'exif' | 'fileLastModified' | '' = '';
  deletingPictureId = '';
  editingPictureId = '';
  editDraftCategory: ClientGalleryCategory = 'other';
  editCaptureDraftLocal = '';
  savingPictureId = '';
  uploadCaptureLocal = '';
  uploadCaptureSource: 'exif' | 'fileLastModified' | 'manual' | '' = '';
  uploadError = '';
  selectedPicture?: ClientGalleryPicture;
  trophyAwardFilter: TrophyGalleryAwardFilter = 'all';
  trophySubjectFilter = '';
  trophyMonthFilter = '';
  trophyYearFilter = '';
  readonly trophyAwardOptions: {
    id: TrophyGalleryAwardFilter;
    label: string;
  }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'team', label: 'Équipe' },
    { id: 'employee', label: 'Employé' },
    { id: 'manager', label: 'Manager' },
  ];
  readonly trophyMonthsList: string[] = [];

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private storage: AngularFireStorage,
    private data: DataService,
    public time: TimeService
  ) {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.ownerType = this.route.snapshot.data['ownerType'] ?? 'client';
    const requestedCategory = this.route.snapshot.queryParamMap.get('category');
    this.trophyMonthsList = [...(this.time.monthFrenchNames || [])];
    if (this.ownerType === 'trophy') {
      this.id = 'trophy-gallery';
      this.activeCategory = 'trophy';
      this.pendingUploadCategory = 'trophy';
      this.editDraftCategory = 'trophy';
      this.trophyAwardFilter = this.normalizeTrophyAwardFilter(
        this.route.snapshot.queryParamMap.get('award')
      );
      this.trophySubjectFilter =
        this.route.snapshot.queryParamMap.get('subject')?.trim() || '';
      this.trophyMonthFilter =
        this.normalizeTrophyMonthFilter(
          this.route.snapshot.queryParamMap.get('month')
        ) || this.trophyMonthsList[new Date().getMonth()] || '';
      this.trophyYearFilter =
        this.route.snapshot.queryParamMap.get('year') ||
        String(new Date().getFullYear());
    } else if (this.isGalleryCategory(requestedCategory || undefined)) {
      this.activeCategory = requestedCategory as ClientGalleryCategory;
      this.pendingUploadCategory = requestedCategory as ClientGalleryCategory;
      this.editDraftCategory = requestedCategory as ClientGalleryCategory;
    }
  }

  ngOnInit(): void {
    this.retrieveOwner();
  }

  ngOnDestroy(): void {
    this.clearPendingUpload();
  }

  retrieveOwner(): void {
    if (this.ownerType === 'trophy') {
      this.data.getTrophyGallery().subscribe((gallery) => {
        this.owner = {
          uid: 'trophy-gallery',
          firstName: 'Trophées',
          lastName: '',
          homeAddress: 'Photos et vidéos des certificats',
          galleryPictures: gallery?.galleryPictures ?? {},
        } as Client;
      });
      return;
    }

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
    if (this.ownerType === 'trophy') {
      return 'Galerie des trophées';
    }

    const parts = [
      this.owner?.firstName,
      this.owner?.middleName,
      this.owner?.lastName,
    ].filter(Boolean);
    return parts.join(' ') || 'Client';
  }

  get backLink(): string[] {
    if (this.ownerType === 'trophy') {
      return ['/certificate'];
    }

    return [
      this.ownerType === 'card' ? '/client-portal-card' : '/client-portal',
      this.id,
    ];
  }

  get ownerInitials(): string {
    if (this.ownerType === 'trophy') {
      return 'TR';
    }

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
    if (this.ownerType === 'trophy') {
      return 'Photos et vidéos des meilleures équipes et meilleurs employés';
    }

    return this.owner?.homeAddress || 'Adresse domicile';
  }

  get visibleCategories(): {
    id: ClientGalleryCategory;
    label: string;
    caption: string;
  }[] {
    return this.ownerType === 'trophy'
      ? this.categories.filter((category) => category.id === 'trophy')
      : this.categories;
  }

  get visibleFilterCategories(): {
    id: GalleryFilterCategory;
    label: string;
    caption: string;
  }[] {
    return this.ownerType === 'trophy'
      ? this.filterCategories.filter((category) => category.id === 'trophy')
      : this.filterCategories;
  }

  get pictures(): ClientGalleryPicture[] {
    const gallery = this.owner?.galleryPictures ?? {};
    const storedPictures = Object.entries(gallery)
      .filter(([, picture]) => Boolean(picture?.url?.trim()))
      .map(([id, picture]) => this.normalizePicture(id, picture))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    const homePicture = this.systemHomePicture();

    if (!homePicture) {
      return storedPictures;
    }

    const alreadyStored = storedPictures.some(
      (picture) => picture.url === homePicture.url
    );

    return alreadyStored ? storedPictures : [homePicture, ...storedPictures];
  }

  get activePictures(): ClientGalleryPicture[] {
    if (this.activeCategory === 'all') {
      return this.pictures;
    }

    return this.pictures.filter(
      (picture) => picture.category === this.activeCategory
    );
  }

  get trophyPictures(): ClientGalleryPicture[] {
    return this.pictures.filter((picture) => {
      if (picture.category !== 'trophy') return false;
      const matchesAward =
        this.trophyAwardFilter === 'all' ||
        picture.trophyAwardType === this.trophyAwardFilter;
      const matchesSubject =
        !this.trophySubjectFilter ||
        this.normalizeTextForFilter(picture.trophySubject) ===
          this.normalizeTextForFilter(this.trophySubjectFilter);
      const matchesMonth =
        !this.trophyMonthFilter || picture.trophyMonth === this.trophyMonthFilter;
      const matchesYear =
        !this.trophyYearFilter || picture.trophyYear === this.trophyYearFilter;
      return matchesAward && matchesSubject && matchesMonth && matchesYear;
    });
  }

  get displayedPictures(): ClientGalleryPicture[] {
    return this.ownerType === 'trophy' ? this.trophyPictures : this.activePictures;
  }

  get trophyYearsList(): string[] {
    const pictureYears = this.pictures
      .map((picture) => picture.trophyYear)
      .filter((year): year is string => !!year);
    return Array.from(
      new Set([
        String(new Date().getFullYear()),
        this.trophyYearFilter,
        ...pictureYears,
      ].filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a));
  }

  get trophyScopeLabel(): string {
    const award =
      this.trophyAwardOptions.find((option) => option.id === this.trophyAwardFilter)
        ?.label || 'Tous';
    return `${award}${
      this.trophySubjectFilter ? ` · ${this.trophySubjectFilter}` : ''
    } · ${this.trophyMonthFilter || 'Mois'} ${
      this.trophyYearFilter || ''
    }`.trim();
  }

  get trophyUploadContextLabel(): string {
    const award =
      this.trophyAwardOptions.find((option) => option.id === this.trophyAwardFilter)
        ?.label || 'Trophée';
    return `${award}${
      this.trophySubjectFilter ? ` · ${this.trophySubjectFilter}` : ''
    } · ${this.trophyMonthFilter} ${this.trophyYearFilter}`;
  }

  onTrophyFilterChange(): void {
    this.activeCategory = 'trophy';
    this.pendingUploadCategory = 'trophy';
    this.editDraftCategory = 'trophy';
  }

  private normalizeTrophyAwardFilter(
    value: string | null
  ): TrophyGalleryAwardFilter {
    return value === 'team' || value === 'employee' || value === 'manager'
      ? value
      : 'all';
  }

  private normalizeTrophyMonthFilter(value: string | null): string {
    if (!value) return '';
    const fromName = this.trophyMonthsList.find(
      (month) => month.toLowerCase() === value.toLowerCase()
    );
    if (fromName) return fromName;

    const monthNumber = Number(value);
    if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
      return this.trophyMonthsList[monthNumber - 1] || '';
    }

    return value;
  }

  private trophyPictureMetadata(): Partial<ClientGalleryPicture> {
    if (this.ownerType !== 'trophy') return {};

    const award =
      this.trophyAwardFilter === 'all' ? undefined : this.trophyAwardFilter;
    return {
      ...(award ? { trophyAwardType: award } : {}),
      ...(this.trophySubjectFilter
        ? { trophySubject: this.trophySubjectFilter }
        : {}),
      ...(this.trophyMonthFilter ? { trophyMonth: this.trophyMonthFilter } : {}),
      ...(this.trophyYearFilter ? { trophyYear: this.trophyYearFilter } : {}),
    };
  }

  private normalizeTrophyPicture(
    picture: ClientGalleryPicture
  ): ClientGalleryPicture {
    if (this.ownerType !== 'trophy') return picture;

    return {
      ...picture,
      category: 'trophy',
      trophyAwardType:
        picture.trophyAwardType ||
        (this.trophyAwardFilter === 'all' ? undefined : this.trophyAwardFilter),
      trophySubject: picture.trophySubject || this.trophySubjectFilter,
      trophyMonth: picture.trophyMonth || this.trophyMonthFilter,
      trophyYear: picture.trophyYear || this.trophyYearFilter,
    };
  }

  private normalizeTextForFilter(value?: string): string {
    return (value || '').trim().toLowerCase();
  }

  get activePictureCount(): number {
    return this.displayedPictures.length;
  }

  private selectedPictureList(): ClientGalleryPicture[] {
    return this.ownerType === 'trophy' ? this.trophyPictures : this.activePictures;
  }

  private categoryPictures(categoryId: GalleryFilterCategory): ClientGalleryPicture[] {
    if (this.ownerType === 'trophy') {
      return categoryId === 'trophy' ? this.trophyPictures : [];
    }

    if (categoryId === 'all') {
      return this.pictures;
    }

    return this.pictures.filter(
      (picture) => picture.category === categoryId
    );
  }

  get editingPicture(): ClientGalleryPicture | undefined {
    if (!this.editingPictureId) {
      return undefined;
    }

    return this.pictures.find((picture) => picture.id === this.editingPictureId);
  }

  activeCategoryLabel(): string {
    return (
      this.filterCategories.find((category) => category.id === this.activeCategory)
        ?.label ?? 'Médias'
    );
  }

  countFor(categoryId: GalleryFilterCategory): number {
    return this.categoryPictures(categoryId).length;
  }

  setActiveCategory(categoryId: GalleryFilterCategory): void {
    if (this.ownerType === 'trophy') {
      this.activeCategory = 'trophy';
      return;
    }

    this.activeCategory = categoryId;
  }

  get uploadCategory(): ClientGalleryCategory {
    if (this.ownerType === 'trophy') {
      return 'trophy';
    }

    return this.activeCategory === 'all' ? 'other' : this.activeCategory;
  }

  get pendingUploadIsVideo(): boolean {
    return this.pendingUploadFile?.type.startsWith('video/') ?? false;
  }

  trackByPictureId(_index: number, picture: ClientGalleryPicture): string {
    return picture.id;
  }

  isSystemHomePicture(picture?: ClientGalleryPicture): boolean {
    return picture?.id === this.systemHomePictureId;
  }

  categoryLabel(categoryId: ClientGalleryCategory): string {
    return (
      this.categories.find((category) => category.id === categoryId)?.label ??
      'Médias'
    );
  }

  isVideoPicture(picture?: ClientGalleryPicture): boolean {
    return this.resolveMediaType(picture) === 'video';
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
      mediaType: this.resolveMediaType(picture),
    };
  }

  private systemHomePicture(): ClientGalleryPicture | undefined {
    if (this.ownerType !== 'client') {
      return undefined;
    }

    const client = this.owner as Client | undefined;
    const picture = client?.homePicture as
      | { path?: string; downloadURL?: string; size?: string | number }
      | string
      | undefined;
    const url =
      typeof picture === 'string' ? picture.trim() : picture?.downloadURL?.trim();

    if (!url) {
      return undefined;
    }

    const picturePath =
      typeof picture === 'string'
        ? 'clients-home/domicile-verification'
        : picture?.path || 'clients-home/domicile-verification';
    const pictureSize =
      typeof picture === 'string' ? 0 : Number(picture?.size || 0);

    return {
      id: this.systemHomePictureId,
      category: 'domicile',
      mediaType: 'image',
      mimeType: 'image/*',
      url,
      path: picturePath,
      size: pictureSize,
      name: 'Photo de la maison visitée',
      uploadedAt: client?.dateOfRequest
        ? this.dateLikeToIso(client.dateOfRequest)
        : new Date(0).toISOString(),
      uploadedByName: 'Enregistrement client',
    };
  }

  private dateLikeToIso(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? new Date(0).toISOString()
      : parsed.toISOString();
  }

  private resolveMediaType(
    picture?: Partial<ClientGalleryPicture>
  ): ClientGalleryMediaType {
    if (picture?.mediaType === 'video') {
      return 'video';
    }

    const mimeType = picture?.mimeType?.toLowerCase() ?? '';
    if (mimeType.startsWith('video/')) {
      return 'video';
    }

    const source = `${picture?.path ?? ''} ${picture?.name ?? ''} ${
      picture?.url ?? ''
    }`.toLowerCase();
    if (/\.(mp4|mov|m4v|webm|ogg)(\?|$|\s)/.test(source)) {
      return 'video';
    }

    return 'image';
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

  async uploadPicture(fileList: FileList | null): Promise<void> {
    const file = fileList?.item(0);
    if (!file) {
      return;
    }

    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      this.uploadError = 'Choisissez une image ou une vidéo valide.';
      this.resetFileInput();
      return;
    }

    const maxSize = mediaType === 'video' ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size >= maxSize) {
      this.uploadError =
        mediaType === 'video'
          ? 'La vidéo est trop grande. Maximum 100MB.'
          : "L'image est trop grande. Maximum 20MB.";
      this.resetFileInput();
      return;
    }

    const owner = this.owner;
    const ownerId = owner?.uid;
    if (!ownerId) {
      this.uploadError = 'Galerie introuvable.';
      this.resetFileInput();
      return;
    }

    this.clearPendingUpload();
    this.pendingUploadFile = file;
    this.pendingUploadPreviewUrl = URL.createObjectURL(file);
    this.pendingUploadCategory = this.uploadCategory;
    this.isPreparingUpload = true;
    this.uploadError = '';

    try {
      const extractedCapture = await this.extractMediaCaptureTime(file);
      if (this.pendingUploadFile !== file) {
        return;
      }

      this.pendingExtractedCaptureISO = extractedCapture.iso;
      this.pendingExtractedCaptureSource = extractedCapture.source;

      if (this.auth.isAdmin && extractedCapture.iso) {
        this.uploadCaptureLocal = this.isoToDateTimeLocal(extractedCapture.iso);
        this.uploadCaptureSource = extractedCapture.source;
      }
    } catch (error) {
      console.error('Erreur lors de la préparation du média', error);
      this.uploadError = 'Impossible de préparer le média. Réessayez.';
      this.clearPendingUpload(true);
    } finally {
      this.isPreparingUpload = false;
    }
  }

  async confirmUploadPicture(): Promise<void> {
    const file = this.pendingUploadFile;
    if (!file) {
      return;
    }

    if (!this.isGalleryCategory(this.pendingUploadCategory)) {
      this.uploadError = 'Catégorie invalide.';
      return;
    }

    const owner = this.owner;
    const ownerId = owner?.uid;
    if (!ownerId) {
      this.uploadError = 'Galerie introuvable.';
      return;
    }

    this.isUploading = true;
    this.uploadError = '';

    try {
      const manualCaptureISO = this.auth.isAdmin
        ? this.dateTimeLocalToISO(this.uploadCaptureLocal)
        : '';
      const captureISO = manualCaptureISO || this.pendingExtractedCaptureISO;
      const captureSource = manualCaptureISO
        ? this.uploadCaptureSource || 'manual'
        : this.pendingExtractedCaptureISO
        ? this.pendingExtractedCaptureSource
        : undefined;
      const pictureId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const uploadCategory = this.pendingUploadCategory;
      const path = `client-gallery/${this.ownerType}/${ownerId}/${uploadCategory}/${pictureId}-${this.cleanFileName(file.name)}`;
      const uploadTask = await this.storage.upload(path, file);
      const url = await uploadTask.ref.getDownloadURL();
      const mediaType: ClientGalleryMediaType = file.type.startsWith('video/')
        ? 'video'
        : 'image';
      const picture: ClientGalleryPicture = {
        id: pictureId,
        category: uploadCategory,
        ...this.trophyPictureMetadata(),
        mediaType,
        mimeType: file.type,
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

      if (this.ownerType === 'trophy') {
        await this.data.replaceTrophyGalleryPictures(galleryPictures);
      } else if (this.ownerType === 'card') {
        await this.data.setCardField('galleryPictures', galleryPictures, ownerId);
      } else {
        await this.data.setClientField(
          'galleryPictures',
          galleryPictures,
          ownerId
        );
      }

      owner.galleryPictures = galleryPictures;
      this.clearPendingUpload(true);
    } catch (error) {
      console.error("Erreur lors de l'ajout du média", error);
      this.uploadError = "Impossible d'ajouter le média. Réessayez.";
    } finally {
      this.isUploading = false;
    }
  }

  cancelUploadModal(): void {
    if (this.isUploading) {
      return;
    }

    this.clearPendingUpload(true);
  }

  openPicture(picture: ClientGalleryPicture): void {
    this.selectedPicture = picture;
  }

  closePicture(): void {
    this.selectedPicture = undefined;
  }

  startEditingPicture(picture: ClientGalleryPicture, event?: Event): void {
    event?.stopPropagation();
    this.editingPictureId = picture.id;
    this.editDraftCategory =
      this.ownerType === 'trophy' ? 'trophy' : picture.category;
    this.editCaptureDraftLocal = this.isoToDateTimeLocal(
      picture.captureTimeOriginalISO
    );
  }

  cancelEditingPicture(event?: Event): void {
    event?.stopPropagation();
    this.editingPictureId = '';
    this.editDraftCategory = 'other';
    this.editCaptureDraftLocal = '';
    this.savingPictureId = '';
  }

  async savePictureEdits(
    picture: ClientGalleryPicture,
    event?: Event
  ): Promise<void> {
    event?.stopPropagation();

    if (!this.isGalleryCategory(this.editDraftCategory)) {
      this.uploadError = 'Catégorie invalide.';
      return;
    }

    const updatedPicture: ClientGalleryPicture = this.normalizeTrophyPicture({
      ...picture,
      category: this.editDraftCategory,
    });

    if (this.auth.isAdmin) {
      const captureISO = this.dateTimeLocalToISO(this.editCaptureDraftLocal);
      if (captureISO) {
        updatedPicture.captureTimeOriginalISO = captureISO;
        updatedPicture.captureTimeSource = 'manual';
      } else {
        delete updatedPicture.captureTimeOriginalISO;
        delete updatedPicture.captureTimeSource;
      }
    }

    this.savingPictureId = picture.id;
    this.uploadError = '';

    try {
      await this.updatePictureMetadata(picture, updatedPicture);
      this.cancelEditingPicture();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du média', error);
      this.uploadError = 'Impossible de modifier le média. Réessayez.';
    } finally {
      this.savingPictureId = '';
    }
  }

  async deletePicture(
    picture: ClientGalleryPicture,
    event?: Event
  ): Promise<void> {
    event?.stopPropagation();

    if (!this.auth.isAdmin) {
      return;
    }

    const confirmed = confirm('Supprimer ce média définitivement ?');
    if (!confirmed) {
      return;
    }

    const owner = this.owner;
    const ownerId = owner?.uid;
    if (!ownerId) {
      this.uploadError = 'Galerie introuvable.';
      return;
    }

    const galleryPictures = { ...(owner.galleryPictures ?? {}) };
    const pictureKeysToDelete = Array.from(
      new Set(
        Object.entries(galleryPictures)
          .filter(([key, storedPicture]) =>
            this.galleryEntryMatchesPicture(key, storedPicture, picture)
          )
          .map(([key]) => key)
      )
    );
    const nextGalleryPictures = { ...galleryPictures };
    pictureKeysToDelete.forEach((key) => delete nextGalleryPictures[key]);

    this.deletingPictureId = picture.id;
    this.uploadError = '';

    try {
      if (this.ownerType === 'trophy') {
        await this.data.replaceTrophyGalleryPictures(nextGalleryPictures);
      } else if (this.ownerType === 'card') {
        await this.data.replaceCardGalleryPictures(
          ownerId,
          nextGalleryPictures
        );
      } else {
        await this.data.replaceClientGalleryPictures(
          ownerId,
          nextGalleryPictures
        );
      }

      owner.galleryPictures = nextGalleryPictures;

      if (this.selectedPicture?.id === picture.id) {
        this.closePicture();
      }
      if (this.editingPictureId === picture.id) {
        this.cancelEditingPicture();
      }

      await this.deleteStoredPictureFile(picture);
    } catch (error) {
      console.error('Erreur lors de la suppression du média', error);
      this.uploadError = 'Impossible de supprimer le média. Réessayez.';
    } finally {
      this.deletingPictureId = '';
    }
  }

  private async updatePictureMetadata(
    picture: ClientGalleryPicture,
    updates: Partial<ClientGalleryPicture>
  ): Promise<ClientGalleryPicture> {
    const owner = this.owner;
    const ownerId = owner?.uid;
    if (!ownerId) {
      throw new Error('Galerie introuvable.');
    }

    const galleryPictures = { ...(owner.galleryPictures ?? {}) };
    const matchingKeys = Object.entries(galleryPictures)
      .filter(([key, storedPicture]) =>
        this.galleryEntryMatchesPicture(key, storedPicture, picture)
      )
      .map(([key]) => key);
    const targetKey = matchingKeys[0] ?? picture.id;
    const existingPicture = galleryPictures[targetKey] ?? picture;
    const updatedPicture: ClientGalleryPicture = {
      ...existingPicture,
      ...updates,
      id: existingPicture.id || picture.id || targetKey,
    };
    const nextGalleryPictures = {
      ...galleryPictures,
      [targetKey]: updatedPicture,
    };

    matchingKeys.slice(1).forEach((key) => {
      delete nextGalleryPictures[key];
    });

    if (this.ownerType === 'trophy') {
      await this.data.replaceTrophyGalleryPictures(nextGalleryPictures);
    } else if (this.ownerType === 'card') {
      await this.data.replaceCardGalleryPictures(ownerId, nextGalleryPictures);
    } else {
      await this.data.replaceClientGalleryPictures(ownerId, nextGalleryPictures);
    }

    owner.galleryPictures = nextGalleryPictures;
    if (this.selectedPicture?.id === picture.id) {
      this.selectedPicture = this.normalizePicture(targetKey, updatedPicture);
    }

    return updatedPicture;
  }

  private galleryEntryMatchesPicture(
    key: string,
    storedPicture: ClientGalleryPicture | undefined,
    picture: ClientGalleryPicture
  ): boolean {
    return (
      key === picture.id ||
      storedPicture?.id === picture.id ||
      Boolean(picture.path && storedPicture?.path === picture.path) ||
      Boolean(picture.url && storedPicture?.url === picture.url)
    );
  }

  get selectedPictureIndex(): number {
    if (!this.selectedPicture) {
      return -1;
    }

    return this.selectedPictureList().findIndex(
      (picture) => picture.id === this.selectedPicture?.id
    );
  }

  get canNavigateSelectedPicture(): boolean {
    return this.selectedPictureList().length > 1;
  }

  get selectedPicturePositionLabel(): string {
    const index = this.selectedPictureIndex;
    if (index < 0) {
      return '';
    }

    return `${index + 1} / ${this.selectedPictureList().length}`;
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
    const pictures = this.selectedPictureList();
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

  private clearPendingUpload(resetInput = false): void {
    if (this.pendingUploadPreviewUrl) {
      URL.revokeObjectURL(this.pendingUploadPreviewUrl);
    }

    this.pendingUploadFile = undefined;
    this.pendingUploadPreviewUrl = '';
    this.pendingUploadCategory = this.uploadCategory;
    this.pendingExtractedCaptureISO = '';
    this.pendingExtractedCaptureSource = '';
    this.uploadCaptureLocal = '';
    this.uploadCaptureSource = '';

    if (resetInput) {
      this.resetFileInput();
    }
  }

  private async deleteStoredPictureFile(
    picture: ClientGalleryPicture
  ): Promise<void> {
    if (!picture.path) {
      return;
    }

    try {
      await firstValueFrom(this.storage.ref(picture.path).delete());
    } catch (error) {
      console.warn(
        "Impossible de supprimer le fichier Storage; suppression des métadonnées quand même.",
        error
      );
    }
  }

  private async extractMediaCaptureTime(
    file: File
  ): Promise<{ iso: string; source: 'exif' | 'fileLastModified' }> {
    if (file.type.startsWith('video/')) {
      return {
        iso: new Date(file.lastModified).toISOString(),
        source: 'fileLastModified',
      };
    }

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
