import { ClientGalleryPicture, Comment } from '../models/client';
import {
  commentsReferenceGalleryPicture,
  legacyCommentImageGalleryPictures,
} from './client-comment-gallery.util';

describe('client comment gallery utilities', () => {
  const legacyComment: Comment = {
    name: 'Agent Test',
    time: '7-25-2026-10-30-15',
    attachments: [
      {
        type: 'image',
        url: 'https://example.com/legacy.jpg',
        path: 'clients-media/images/legacy.jpg',
        name: 'legacy.jpg',
        mimeType: 'image/jpeg',
        size: 2048,
        captureTimeOriginalISO: '2026-07-25T16:00:00.000Z',
        captureTimeSource: 'exif',
      },
      {
        type: 'video',
        url: 'https://example.com/video.mp4',
        mimeType: 'video/mp4',
        size: 4096,
      },
    ],
  };

  it('exposes previously posted comment images under Autres', () => {
    const pictures = legacyCommentImageGalleryPictures([legacyComment], {});

    expect(pictures.length).toBe(1);
    expect(pictures[0]).toEqual(
      jasmine.objectContaining({
        category: 'other',
        mediaType: 'image',
        source: 'comment',
        derivedFromComment: true,
        url: 'https://example.com/legacy.jpg',
        path: 'clients-media/images/legacy.jpg',
        uploadedByName: 'Agent Test',
      })
    );
  });

  it('does not duplicate a comment image already stored in the gallery', () => {
    const stored: Record<string, ClientGalleryPicture> = {
      existing: {
        id: 'existing',
        category: 'other',
        mediaType: 'image',
        url: 'https://example.com/legacy.jpg',
        path: 'client-gallery/existing.jpg',
        size: 2048,
        uploadedAt: '2026-07-25T17:00:00.000Z',
      },
    };

    expect(legacyCommentImageGalleryPictures([legacyComment], stored)).toEqual(
      []
    );
  });

  it('does not recreate a new comment image after its gallery entry is removed', () => {
    const comment: Comment = {
      attachments: [
        {
          id: 'comment-image-1',
          galleryPictureId: 'comment-image-1',
          type: 'image',
          url: 'https://example.com/new.jpg',
          path: 'clients-media/images/new.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        },
      ],
    };

    expect(legacyCommentImageGalleryPictures([comment], {})).toEqual([]);
  });

  it('detects when deleting a gallery entry would break a comment image', () => {
    const picture: ClientGalleryPicture = {
      id: 'comment-image-1',
      category: 'other',
      mediaType: 'image',
      url: 'https://example.com/new.jpg',
      path: 'clients-media/images/new.jpg',
      size: 1024,
      uploadedAt: '2026-07-25T18:00:00.000Z',
      source: 'comment',
    };
    const comment: Comment = {
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
    };

    expect(commentsReferenceGalleryPicture([comment], picture)).toBeTrue();
    expect(commentsReferenceGalleryPicture([], picture)).toBeFalse();
  });
});
