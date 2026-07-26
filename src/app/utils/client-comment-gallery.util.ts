import {
  ClientCommentAttachment,
  ClientGalleryPicture,
  Comment,
} from '../models/client';

type GalleryPictureMap = {
  [key: string]: ClientGalleryPicture;
};

interface CommentGalleryPictureOptions {
  id: string;
  uploadedAt: string;
  uploadedBy?: string;
  uploadedByName?: string;
  derivedFromComment?: boolean;
}

export function commentImageToGalleryPicture(
  attachment: ClientCommentAttachment,
  options: CommentGalleryPictureOptions
): ClientGalleryPicture {
  return {
    id: options.id,
    category: 'other',
    mediaType: 'image',
    mimeType: attachment.mimeType,
    url: attachment.url,
    path: attachment.path || '',
    size: Number(attachment.size) || 0,
    name: attachment.name || 'Image du commentaire',
    uploadedAt: validIso(options.uploadedAt) || new Date(0).toISOString(),
    ...(options.uploadedBy ? { uploadedBy: options.uploadedBy } : {}),
    ...(options.uploadedByName
      ? { uploadedByName: options.uploadedByName }
      : {}),
    ...(attachment.captureTimeOriginalISO
      ? { captureTimeOriginalISO: attachment.captureTimeOriginalISO }
      : {}),
    ...(attachment.captureTimeSource
      ? { captureTimeSource: attachment.captureTimeSource }
      : {}),
    source: 'comment',
    ...(attachment.id
      ? { sourceCommentAttachmentId: attachment.id }
      : {}),
    ...(options.derivedFromComment ? { derivedFromComment: true } : {}),
  };
}

export function legacyCommentImageGalleryPictures(
  comments: Comment[] | undefined,
  storedPictures: GalleryPictureMap | undefined
): ClientGalleryPicture[] {
  const storedUrls = new Set(
    Object.values(storedPictures || {})
      .map((picture) => picture?.url?.trim())
      .filter((url): url is string => Boolean(url))
  );
  const derivedUrls = new Set<string>();
  const pictures: ClientGalleryPicture[] = [];

  (comments || []).forEach((comment) => {
    (comment?.attachments || []).forEach((attachment) => {
      const url = attachment?.url?.trim();
      if (
        attachment?.type !== 'image' ||
        !url ||
        attachment.galleryPictureId ||
        storedUrls.has(url) ||
        derivedUrls.has(url)
      ) {
        return;
      }

      derivedUrls.add(url);
      pictures.push(
        commentImageToGalleryPicture(attachment, {
          id: `legacy-comment-${stableUrlHash(url)}`,
          uploadedAt: bestCommentPictureDate(comment, attachment),
          uploadedByName: comment.name,
          derivedFromComment: true,
        })
      );
    });
  });

  return pictures.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function commentsReferenceGalleryPicture(
  comments: Comment[] | undefined,
  picture: ClientGalleryPicture
): boolean {
  return (comments || []).some((comment) =>
    (comment?.attachments || []).some(
      (attachment) =>
        attachment?.type === 'image' &&
        (Boolean(
          attachment.galleryPictureId &&
            attachment.galleryPictureId === picture.id
        ) ||
          Boolean(attachment.url && attachment.url === picture.url) ||
          Boolean(
            attachment.path &&
              picture.path &&
              attachment.path === picture.path
          ))
    )
  );
}

function bestCommentPictureDate(
  comment: Comment,
  attachment: ClientCommentAttachment
): string {
  return (
    validIso(attachment.uploadedAt) ||
    validIso(attachment.captureTimeOriginalISO) ||
    legacyCommentTimeToIso(comment.time) ||
    validIso(comment.timeFormatted) ||
    new Date(0).toISOString()
  );
}

function legacyCommentTimeToIso(value?: string): string {
  if (!value) {
    return '';
  }

  const parts = value.split('-').map((part) => Number(part));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
    return '';
  }

  const [month, day, year, hours = 0, minutes = 0, seconds = 0] = parts;
  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function validIso(value?: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function stableUrlHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
