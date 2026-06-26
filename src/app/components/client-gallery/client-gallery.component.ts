import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireStorage } from '@angular/fire/compat/storage';
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

  id = '';
  ownerType: GalleryOwnerType = 'client';
  owner?: GalleryOwner;
  activeCategory: ClientGalleryCategory = 'domicile';
  isUploading = false;
  reclassifyingPictureId = '';
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

  get ownerAddress(): string {
    return this.owner?.homeAddress || 'Adresse domicile';
  }

  get pictures(): ClientGalleryPicture[] {
    const gallery = this.owner?.galleryPictures ?? {};
    return Object.entries(gallery)
      .map(([id, picture]) => ({
        ...picture,
        id: picture.id || id,
      }))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  get activePictures(): ClientGalleryPicture[] {
    return this.pictures.filter(
      (picture) => picture.category === this.activeCategory
    );
  }

  activeCategoryLabel(): string {
    return (
      this.categories.find((category) => category.id === this.activeCategory)
        ?.label ?? 'Photos'
    );
  }

  countFor(categoryId: ClientGalleryCategory): number {
    return this.pictures.filter((picture) => picture.category === categoryId)
      .length;
  }

  setActiveCategory(categoryId: ClientGalleryCategory): void {
    this.activeCategory = categoryId;
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

  async reclassifyPicture(
    picture: ClientGalleryPicture,
    nextCategory: ClientGalleryCategory
  ): Promise<void> {
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
      const pictureId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const path = `client-gallery/${this.ownerType}/${ownerId}/${this.activeCategory}/${pictureId}-${this.cleanFileName(file.name)}`;
      const uploadTask = await this.storage.upload(path, file);
      const url = await uploadTask.ref.getDownloadURL();
      const picture: ClientGalleryPicture = {
        id: pictureId,
        category: this.activeCategory,
        url,
        path,
        size: uploadTask.totalBytes || file.size,
        name: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: this.auth.currentUser?.uid,
        uploadedByName: this.auth.currentUser?.firstName,
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
}
