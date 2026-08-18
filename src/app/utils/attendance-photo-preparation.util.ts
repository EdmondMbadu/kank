export const ATTENDANCE_PHOTO_TARGET_BYTES = 350 * 1024;
export const ATTENDANCE_PHOTO_MAX_BYTES = 500 * 1024;
export const ATTENDANCE_PHOTO_MAX_DIMENSION = 1440;

export interface AttendancePreparedPhoto {
  file: File;
  originalSize: number;
  uploadSize: number;
  width: number;
  height: number;
}

export interface AttendanceDecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

export interface AttendanceImageCodec {
  decode(blob: Blob): Promise<AttendanceDecodedImage>;
  encode(
    source: CanvasImageSource,
    width: number,
    height: number,
    quality: number
  ): Promise<Blob>;
}

export interface AttendancePhotoPreparationOptions {
  decodedInput?: Blob;
  maxBytes?: number;
  maxDimension?: number;
  targetBytes?: number;
}

function fitInside(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }

  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function attendanceJpegName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'presence';
  return `${base}-presence.jpg`;
}

function canvasToJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    return Promise.reject(new Error("Impossible de préparer l'image."));
  }

  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Impossible de compresser l'image.")),
      'image/jpeg',
      quality
    );
  });
}

async function decodeWithBrowser(blob: Blob): Promise<AttendanceDecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(
        blob,
        { imageOrientation: 'from-image' } as unknown as ImageBitmapOptions
      );
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Older Safari/iOS versions need the HTMLImageElement fallback.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = 'async';

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossible de lire l'image."));
      image.src = objectUrl;
    });
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(objectUrl),
  };
}

const browserAttendanceImageCodec: AttendanceImageCodec = {
  decode: decodeWithBrowser,
  encode: canvasToJpeg,
};

/**
 * Produces a small, consistently decodable attendance proof while callers keep
 * the original file for EXIF extraction and hashing. The adaptive loop lowers
 * JPEG quality first, then dimensions, so text and faces remain legible.
 */
export async function prepareAttendancePhoto(
  originalFile: File,
  options: AttendancePhotoPreparationOptions = {},
  codec: AttendanceImageCodec = browserAttendanceImageCodec
): Promise<AttendancePreparedPhoto> {
  const targetBytes = Math.max(
    64 * 1024,
    options.targetBytes ?? ATTENDANCE_PHOTO_TARGET_BYTES
  );
  const maxBytes = Math.max(
    targetBytes,
    options.maxBytes ?? ATTENDANCE_PHOTO_MAX_BYTES
  );
  const maxDimension = Math.max(
    640,
    options.maxDimension ?? ATTENDANCE_PHOTO_MAX_DIMENSION
  );
  const decoded = await codec.decode(options.decodedInput ?? originalFile);

  if (
    !Number.isFinite(decoded.width) ||
    !Number.isFinite(decoded.height) ||
    decoded.width < 1 ||
    decoded.height < 1
  ) {
    decoded.release();
    throw new Error("Dimensions de l'image invalides.");
  }

  try {
    let dimensions = fitInside(decoded.width, decoded.height, maxDimension);
    let smallest: Blob | null = null;
    let smallestDimensions = dimensions;
    const qualities = [0.82, 0.74, 0.66, 0.58];

    for (let dimensionPass = 0; dimensionPass < 4; dimensionPass += 1) {
      for (const quality of qualities) {
        const candidate = await codec.encode(
          decoded.source,
          dimensions.width,
          dimensions.height,
          quality
        );
        if (!smallest || candidate.size < smallest.size) {
          smallest = candidate;
          smallestDimensions = dimensions;
        }
        if (candidate.size <= targetBytes) {
          smallest = candidate;
          smallestDimensions = dimensions;
          dimensionPass = 4;
          break;
        }
      }

      if (dimensionPass >= 4 || (smallest && smallest.size <= targetBytes)) {
        break;
      }

      const ratio = smallest
        ? Math.sqrt(targetBytes / Math.max(1, smallest.size)) * 0.94
        : 0.82;
      const scale = Math.min(0.86, Math.max(0.68, ratio));
      dimensions = {
        width: Math.max(1, Math.round(dimensions.width * scale)),
        height: Math.max(1, Math.round(dimensions.height * scale)),
      };
    }

    if (!smallest || smallest.size > maxBytes) {
      throw new Error(
        "La photo reste trop volumineuse après optimisation. Choisissez une autre photo."
      );
    }

    const file = new File([smallest], attendanceJpegName(originalFile.name), {
      type: 'image/jpeg',
      lastModified: originalFile.lastModified,
    });

    return {
      file,
      originalSize: originalFile.size,
      uploadSize: file.size,
      width: smallestDimensions.width,
      height: smallestDimensions.height,
    };
  } finally {
    decoded.release();
  }
}
