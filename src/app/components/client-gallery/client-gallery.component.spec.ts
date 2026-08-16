import { ActivatedRoute } from '@angular/router';
import { AngularFireStorage } from '@angular/fire/compat/storage';

import { ClientGalleryComponent } from './client-gallery.component';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

describe('ClientGalleryComponent comment pictures', () => {
  function createComponent(
    storage: AngularFireStorage = {} as AngularFireStorage
  ): ClientGalleryComponent {
    return new ClientGalleryComponent(
      { isAdmin: true } as AuthService,
      {
        snapshot: {
          paramMap: { get: () => '23' },
          queryParamMap: { get: () => null },
          data: { ownerType: 'client' },
        },
      } as unknown as ActivatedRoute,
      storage,
      {} as DataService,
      { monthFrenchNames: [] } as unknown as TimeService
    );
  }

  it('shows a previously posted comment image in Autres', () => {
    const component = createComponent();
    component.owner = {
      uid: 'client-23',
      comments: [
        {
          name: 'Agent Test',
          time: '7-25-2026-10-30-15',
          attachments: [
            {
              type: 'image',
              url: 'https://example.com/legacy.jpg',
              path: 'clients-media/images/legacy.jpg',
              mimeType: 'image/jpeg',
              size: 2048,
            },
          ],
        },
      ],
      galleryPictures: {},
    } as any;
    component.activeCategory = 'other';

    expect(component.displayedPictures.length).toBe(1);
    expect(component.displayedPictures[0].category).toBe('other');
    expect(component.displayedPictures[0].url).toBe(
      'https://example.com/legacy.jpg'
    );
    expect(component.canEditPicture(component.displayedPictures[0])).toBeFalse();
  });

  it('keeps a shared Storage file when its gallery entry is deleted', async () => {
    const storage = jasmine.createSpyObj<AngularFireStorage>(
      'AngularFireStorage',
      ['ref']
    );
    const component = createComponent(storage);
    const picture = {
      id: 'comment-image-1',
      category: 'other',
      mediaType: 'image',
      url: 'https://example.com/new.jpg',
      path: 'clients-media/images/new.jpg',
      size: 1024,
      uploadedAt: '2026-07-25T18:00:00.000Z',
      source: 'comment',
    } as const;
    component.owner = {
      uid: 'client-23',
      comments: [
        {
          attachments: [
            {
              id: 'comment-image-1',
              galleryPictureId: 'comment-image-1',
              type: 'image',
              url: picture.url,
              path: picture.path,
              mimeType: 'image/jpeg',
              size: picture.size,
            },
          ],
        },
      ],
      galleryPictures: { [picture.id]: picture },
    } as any;

    await (component as any).deleteStoredPictureFile(picture);

    expect(storage.ref).not.toHaveBeenCalled();
  });

  it('recognizes a responsibility document while keeping it in Autres', () => {
    const component = createComponent();
    component.owner = {
      uid: 'client-23',
      galleryPictures: {
        responsibility: {
          id: 'responsibility',
          category: 'other',
          mediaType: 'image',
          documentType: 'payment_responsibility',
          paymentResponsibleName: 'Marie Kavanda',
          paymentResponsibilityEffectiveAt: '2026-08-15T16:07:06.045Z',
          url: 'https://example.com/responsibility.jpg',
          path: 'client-gallery/client/site/client/payment-responsibility/image.jpg',
          size: 1024,
          uploadedAt: '2026-08-15T16:07:06.045Z',
        },
      },
    } as any;
    component.activeCategory = 'other';

    expect(component.displayedPictures.length).toBe(1);
    expect(
      component.isPaymentResponsibilityPicture(component.displayedPictures[0])
    ).toBeTrue();
    expect(component.displayedPictures[0].category).toBe('other');
  });
});
