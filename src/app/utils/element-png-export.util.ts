export interface ElementPngExportOptions {
  fileName: string;
  captureWidth?: number;
  preferredScale?: number;
  maxCanvasPixels?: number;
  maxCanvasDimension?: number;
  backgroundColor?: string;
  exportClassName?: string;
  excludeSelector?: string;
}

interface ElementPngExportDependencies {
  document?: Document;
  download?: ElementPngDownloader;
  window?: Window;
  render?: ElementPngRenderer;
}

interface ElementPngRendererOptions {
  allowTaint: boolean;
  backgroundColor: string;
  height: number;
  imageTimeout: number;
  logging: boolean;
  onclone: (clonedDocument: Document) => void;
  removeContainer: boolean;
  scale: number;
  scrollX: number;
  scrollY: number;
  useCORS: boolean;
  width: number;
  windowHeight: number;
  windowWidth: number;
}

type ElementPngRenderer = (
  element: HTMLElement,
  options: ElementPngRendererOptions
) => Promise<HTMLCanvasElement>;

type ElementPngDownloader = (
  blob: Blob,
  fileName: string,
  documentRef: Document,
  windowRef: Window
) => void;

const DEFAULT_CAPTURE_WIDTH = 1320;
const DEFAULT_MAX_CANVAS_PIXELS = 16_000_000;
const DEFAULT_MAX_CANVAS_DIMENSION = 8192;

function nextAnimationFrame(windowRef: Window): Promise<void> {
  return new Promise((resolve) => windowRef.requestAnimationFrame(() => resolve()));
}

async function waitForFonts(documentRef: Document): Promise<void> {
  const fonts = documentRef.fonts;
  if (!fonts?.ready) return;

  await Promise.race([
    fonts.ready.then(() => undefined),
    new Promise<void>((resolve) =>
      documentRef.defaultView?.setTimeout(resolve, 3000)
    ),
  ]);
}

function safeScale(
  width: number,
  height: number,
  preferredScale: number,
  maxCanvasPixels: number,
  maxCanvasDimension: number
): number {
  const pixelScale = Math.sqrt(maxCanvasPixels / Math.max(1, width * height));
  const dimensionScale = Math.min(
    maxCanvasDimension / Math.max(1, width),
    maxCanvasDimension / Math.max(1, height)
  );

  return Math.max(0.25, Math.min(preferredScale, pixelScale, dimensionScale));
}

async function defaultRenderer(
  element: HTMLElement,
  options: ElementPngRendererOptions
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default;
  return html2canvas(element, options);
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('La génération de l’image PNG a échoué.')),
      'image/png'
    );
  });
}

function normalizePngFileName(fileName: string): string {
  const sanitized = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const baseName = sanitized || 'paiement-semaine';
  return baseName.toLowerCase().endsWith('.png')
    ? baseName
    : `${baseName}.png`;
}

function downloadBlob(
  blob: Blob,
  fileName: string,
  documentRef: Document,
  windowRef: Window
): void {
  const urlApi = (windowRef as unknown as { URL?: typeof URL }).URL || URL;
  if (!urlApi?.createObjectURL) {
    throw new Error('Le navigateur ne permet pas de télécharger cette capture.');
  }

  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  documentRef.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    windowRef.setTimeout(() => urlApi.revokeObjectURL(objectUrl), 1000);
  }
}

export async function exportElementAsPng(
  source: HTMLElement,
  options: ElementPngExportOptions,
  dependencies: ElementPngExportDependencies = {}
): Promise<void> {
  const documentRef = dependencies.document || source.ownerDocument;
  const windowRef = dependencies.window || documentRef.defaultView;
  if (!windowRef || !documentRef.body) {
    throw new Error('Le navigateur ne permet pas de générer cette capture.');
  }

  const captureWidth = Math.max(
    940,
    Math.round(options.captureWidth || DEFAULT_CAPTURE_WIDTH)
  );
  const exportClassName =
    options.exportClassName || 'weekly-payment-capture--export';
  const excludeSelector =
    options.excludeSelector || '[data-capture-exclude="true"]';
  const host = documentRef.createElement('div');
  const clone = source.cloneNode(true) as HTMLElement;

  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('data-element-png-export-host', 'true');
  host.style.position = 'fixed';
  host.style.inset = '0 auto auto 0';
  host.style.zIndex = '-2147483647';
  host.style.pointerEvents = 'none';
  host.style.width = `${captureWidth}px`;
  host.style.maxWidth = 'none';

  clone.removeAttribute('id');
  clone.classList.add(exportClassName);
  clone.style.width = `${captureWidth}px`;
  clone.style.maxWidth = 'none';
  clone.querySelectorAll(excludeSelector).forEach((element) => element.remove());
  host.appendChild(clone);
  documentRef.body.appendChild(host);

  try {
    await waitForFonts(documentRef);
    await nextAnimationFrame(windowRef);
    await nextAnimationFrame(windowRef);

    const width = Math.max(captureWidth, Math.ceil(clone.scrollWidth));
    const height = Math.max(1, Math.ceil(clone.scrollHeight));
    const scale = safeScale(
      width,
      height,
      Math.max(1, options.preferredScale || 2),
      Math.max(1, options.maxCanvasPixels || DEFAULT_MAX_CANVAS_PIXELS),
      Math.max(1, options.maxCanvasDimension || DEFAULT_MAX_CANVAS_DIMENSION)
    );
    const render = dependencies.render || defaultRenderer;
    const canvas = await render(clone, {
      allowTaint: false,
      backgroundColor: options.backgroundColor || '#ffffff',
      height,
      imageTimeout: 15000,
      logging: false,
      onclone: (clonedDocument) => {
        clonedDocument.documentElement.classList.remove('dark');
        clonedDocument.body.classList.remove('dark');
      },
      removeContainer: true,
      scale,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      width,
      windowHeight: height,
      windowWidth: width,
    });
    const blob = await canvasToPng(canvas);
    const download = dependencies.download || downloadBlob;
    download(
      blob,
      normalizePngFileName(options.fileName),
      documentRef,
      windowRef
    );
  } finally {
    host.remove();
  }
}
