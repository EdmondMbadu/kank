import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';

import { ClientPortalComponent } from './client-portal.component';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

describe('ClientPortalComponent', () => {
  function createComponent(
    dataService: DataService = {} as DataService,
    storage: AngularFireStorage = {} as AngularFireStorage
  ): ClientPortalComponent {
    return new ClientPortalComponent(
      {
        currentUser: {
          uid: 'admin-1',
          email: 'admin@example.com',
          firstName: 'Admin',
        },
        isAdmninistrator: true,
        isAdmin: true,
      } as AuthService,
      {
        snapshot: {
          paramMap: {
            get: () => '2',
          },
          queryParamMap: {
            get: () => null,
          },
        },
      } as unknown as ActivatedRoute,
      {} as Router,
      {
        todaysDate: () => '7-25-2026-18-0-0',
      } as TimeService,
      dataService,
      {
        getGradientColor: () => '#16a34a',
        convertCongoleseFrancToUsDollars: (value: string) =>
          Math.ceil(Number(value) * 0.00034),
      } as unknown as ComputationService,
      storage,
      {} as ChangeDetectorRef
    );
  }

  it('should create', () => {
    const component = createComponent();

    expect(component).toBeTruthy();
  });

  it('should select all previous cycles by default and sum their benefits', () => {
    const component = createComponent();

    component.clientCycles = [
      {
        cycleId: 'cycle-4',
        loanAmount: '1000',
        amountPaid: '1300',
        debtLeft: '0',
        amountToPay: '1300',
      },
      {
        cycleId: 'cycle-5',
        loanAmount: '2500',
        amountPaid: '3100',
        amountToPay: '3100',
      },
    ] as any;

    (component as any).syncSelectedClientCycles(component.clientCycles);
    (component as any).recalculateClientGeneratedBenefit();

    expect(component.selectedClientCycleIds.size).toBe(2);
    expect(component.clientGeneratedBenefit).toBe(900);
    expect(component.clientGeneratedBenefitUsd).toBe(1);
    expect(component.finishedClientCyclesCount).toBe(2);
  });

  it('should update the total when a cycle is deselected', () => {
    const component = createComponent();

    component.clientCycles = [
      {
        cycleId: 'cycle-4',
        loanAmount: '2000',
        amountPaid: '2000',
        debtLeft: '500',
        amountToPay: '3000',
      },
      {
        cycleId: 'cycle-5',
        loanAmount: '1500',
        amountPaid: '1800',
        debtLeft: '0',
      },
    ] as any;

    (component as any).syncSelectedClientCycles(component.clientCycles);
    component.toggleClientCycleSelection(component.clientCycles[0] as any);

    expect(component.clientGeneratedBenefit).toBe(300);
    expect(component.clientGeneratedBenefitUsd).toBe(1);
    expect(component.finishedClientCyclesCount).toBe(1);
    expect(component.isCycleSelected(component.clientCycles[0] as any)).toBeFalse();
    expect(component.isCycleSelected(component.clientCycles[1] as any)).toBeTrue();
  });

  it('should count archived cycles even when finish flags are stale', () => {
    const component = createComponent();

    component.clientCycles = [
      {
        cycleId: 'cycle-4',
        loanAmount: '2000',
        amountPaid: '2000',
        debtLeft: '500',
        amountToPay: '3000',
      },
      {
        cycleId: 'cycle-5',
        loanAmount: '1500',
        amountPaid: 'abc',
        debtLeft: '0',
        amountToPay: '1700',
      },
      {
        loanAmount: '',
        amountPaid: '1600',
        debtLeft: '0',
      },
    ] as any;

    (component as any).syncSelectedClientCycles(component.clientCycles);
    (component as any).recalculateClientGeneratedBenefit();

    expect(component.clientGeneratedBenefit).toBe(1200);
    expect(component.clientGeneratedBenefitUsd).toBe(1);
    expect(component.finishedClientCyclesCount).toBe(2);
  });

  it('should expose trophy awards sorted by awarded date descending', () => {
    const component = createComponent();

    component.client.trophyAwards = {
      a: {
        awardedOn: '2026-04-01',
        cycle: '6',
        amountUsd: '50',
        createdAt: '2026-04-01T10:00:00.000Z',
      },
      b: {
        awardedOn: '2026-04-05',
        cycle: '7',
        amountUsd: '100',
        createdAt: '2026-04-05T10:00:00.000Z',
      },
    };

    expect(component.trophyAwardList.map((award) => award.id)).toEqual([
      'b',
      'a',
    ]);
    expect(component.trophyAwardAmountValue(component.trophyAwardList[0])).toBe(
      100
    );
  });

  it('should save a comment image and its gallery entry in one write', async () => {
    const dataService = jasmine.createSpyObj<DataService>('DataService', [
      'addCommentToClientProfileWithGalleryPictures',
    ]);
    dataService.addCommentToClientProfileWithGalleryPictures.and.resolveTo();
    const component = createComponent(dataService);
    spyOn(window, 'alert');

    component.client.uid = 'client-1';
    component.personPostingComment = 'Agent Test';
    component.comment = 'Photo du client';

    await (component as any).postCommentToFirestoreWithAttachments(null, [
      {
        id: 'comment-image-1',
        type: 'image',
        url: 'https://example.com/comment-image.jpg',
        name: 'client.jpg',
        path: 'clients-media/images/client-1-comment-image-1-client.jpg',
        mimeType: 'image/jpeg',
        size: 1234,
        uploadedAt: '2026-07-25T18:00:00.000Z',
        uploadedBy: 'admin-1',
        galleryPictureId: 'comment-image-1',
        captureTimeOriginalISO: '2026-07-25T17:00:00.000Z',
        captureTimeSource: 'exif',
      },
    ]);

    expect(
      dataService.addCommentToClientProfileWithGalleryPictures
    ).toHaveBeenCalledTimes(1);
    const [, savedComments, savedPictures] =
      dataService.addCommentToClientProfileWithGalleryPictures.calls.mostRecent()
        .args;
    expect(savedComments.length).toBe(1);
    expect(savedComments[0].attachments?.[0].galleryPictureId).toBe(
      'comment-image-1'
    );
    expect(savedPictures).toEqual([
      jasmine.objectContaining({
        id: 'comment-image-1',
        category: 'other',
        source: 'comment',
        url: 'https://example.com/comment-image.jpg',
        path: 'clients-media/images/client-1-comment-image-1-client.jpg',
      }),
    ]);
    expect(component.client.galleryPictures?.['comment-image-1']).toEqual(
      jasmine.objectContaining({
        category: 'other',
        source: 'comment',
      })
    );
  });

  it('should upload a new comment image only once', async () => {
    const storage = jasmine.createSpyObj<AngularFireStorage>(
      'AngularFireStorage',
      ['upload']
    );
    storage.upload.and.resolveTo({
      totalBytes: 1234,
      ref: {
        getDownloadURL: () =>
          Promise.resolve('https://example.com/comment-image.jpg'),
      },
    } as any);
    const component = createComponent({} as DataService, storage);
    component.client.uid = 'client-1';
    component.selectedImageFile = new File(['image'], 'client.jpg', {
      type: 'image/jpeg',
      lastModified: Date.parse('2026-07-25T17:00:00.000Z'),
    });

    const attachment = await (component as any).uploadImageForComment();

    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(attachment.galleryPictureId).toBe(attachment.id);
    expect(attachment.path).toContain(attachment.id);
    expect(attachment.url).toBe(
      'https://example.com/comment-image.jpg'
    );
  });

  it('should expose a responsibility indicator only when a document exists', () => {
    const component = createComponent();
    expect(component.latestPaymentResponsibilityDocument).toBeUndefined();

    component.client.galleryPictures = {
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
    };

    expect(component.latestPaymentResponsibilityDocument).toEqual(
      jasmine.objectContaining({
        id: 'responsibility',
        paymentResponsibleName: 'Marie Kavanda',
      })
    );
  });

  it('should close the compact details before opening the attestation', () => {
    const component = createComponent();
    const picture = {
      id: 'responsibility',
      category: 'other',
      documentType: 'payment_responsibility',
      url: 'https://example.com/responsibility.jpg',
      path: 'responsibility.jpg',
      size: 1024,
      uploadedAt: '2026-08-15T16:07:06.045Z',
    } as const;
    component.showPaymentResponsibilityDetails = true;
    spyOn(component, 'toggleHomePicture');

    component.openPaymentResponsibilityDocument(picture);

    expect(component.showPaymentResponsibilityDetails).toBeFalse();
    expect(component.toggleHomePicture).toHaveBeenCalledWith(picture.url);
  });

  it('should navigate to the linked responsible client and preserve site context', () => {
    const component = createComponent();
    const router = (component as any).router as jasmine.SpyObj<Router>;
    router.navigate = jasmine.createSpy('navigate');
    component.client.locationOwnerId = 'site-edmond';
    component.showPaymentResponsibilityDetails = true;

    component.openPaymentResponsibleClient({
      id: 'responsibility',
      category: 'other',
      documentType: 'payment_responsibility',
      paymentResponsibleClientId: 'responsible-client-2',
      paymentResponsibleLocationOwnerId: 'site-edmond',
      url: 'https://example.com/responsibility.jpg',
      path: 'responsibility.jpg',
      size: 1024,
      uploadedAt: '2026-08-15T16:07:06.045Z',
    });

    expect(component.showPaymentResponsibilityDetails).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/client-portal', 'responsible-client-2'],
      { queryParams: { owner: 'site-edmond' } }
    );
  });
});
