import { exportElementAsPng } from './element-png-export.util';

describe('exportElementAsPng', () => {
  let source: HTMLElement;
  let downloadSpy: jasmine.Spy;

  beforeEach(() => {
    source = document.createElement('section');
    source.innerHTML = `
      <header>Paiement de la Semaine</header>
      <button data-capture-exclude="true">Prendre une capture</button>
      <table>
        <tbody><tr data-weekly-payment-row><td>Pumbu</td></tr></tbody>
        <tfoot><tr data-weekly-payment-total-row><td>Total semaine</td></tr></tfoot>
      </table>
    `;
    document.body.appendChild(source);
    downloadSpy = jasmine.createSpy('download');
  });

  afterEach(() => {
    source.remove();
  });

  it('renders a detached complete clone and downloads exactly one PNG', async () => {
    let renderedClone: HTMLElement | undefined;
    let renderedOptions: any;
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await exportElementAsPng(
      source,
      {
        fileName: 'paiement semaine 2026-08-17 au 2026-08-23',
        captureWidth: 1320,
      },
      {
        download: downloadSpy,
        render: async (clone, options) => {
          renderedClone = clone;
          renderedOptions = options;
          return canvas;
        },
      }
    );

    expect(renderedClone).toBeDefined();
    expect(renderedClone!.classList).toContain(
      'weekly-payment-capture--export'
    );
    expect(
      renderedClone!.querySelector('[data-capture-exclude="true"]')
    ).toBeNull();
    expect(renderedClone!.querySelectorAll('[data-weekly-payment-row]')).toHaveSize(
      1
    );
    expect(
      renderedClone!.querySelector('[data-weekly-payment-total-row]')
    ).not.toBeNull();
    expect(renderedOptions.width).toBeGreaterThanOrEqual(1320);
    expect(renderedOptions.scale).toBeGreaterThanOrEqual(1);
    expect(renderedOptions.backgroundColor).toBe('#ffffff');
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy.calls.mostRecent().args[1]).toBe(
      'paiement-semaine-2026-08-17-au-2026-08-23.png'
    );
    expect(document.querySelector('[data-element-png-export-host]')).toBeNull();
    expect(source.querySelector('[data-capture-exclude="true"]')).not.toBeNull();
  });

  it('caps the render scale to protect memory on a constrained browser', async () => {
    let renderedScale = 0;
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;

    await exportElementAsPng(
      source,
      {
        fileName: 'capture.png',
        captureWidth: 1320,
        preferredScale: 3,
        maxCanvasPixels: 100,
        maxCanvasDimension: 100,
      },
      {
        download: downloadSpy,
        render: async (_clone, options) => {
          renderedScale = options.scale;
          return canvas;
        },
      }
    );

    expect(renderedScale).toBe(0.25);
  });

  it('renders a real browser PNG without cropping the report width', async () => {
    source.style.width = '940px';
    source.style.padding = '20px';
    source.style.background = '#ffffff';
    let downloadedBlob: Blob | undefined;

    await exportElementAsPng(
      source,
      {
        fileName: 'capture-reelle.png',
        captureWidth: 940,
        preferredScale: 1,
      },
      {
        download: (blob) => {
          downloadedBlob = blob;
        },
      }
    );

    expect(downloadedBlob).toBeDefined();
    expect(downloadedBlob!.type).toBe('image/png');
    expect(downloadedBlob!.size).toBeGreaterThan(100);

    const bitmap = await createImageBitmap(downloadedBlob!);
    expect(bitmap.width).toBeGreaterThanOrEqual(940);
    expect(bitmap.height).toBeGreaterThan(0);
    bitmap.close();
  });

  it('removes the detached report when rendering fails', async () => {
    await expectAsync(
      exportElementAsPng(
        source,
        { fileName: 'capture.png' },
        {
          download: downloadSpy,
          render: async () => {
            throw new Error('renderer failed');
          },
        }
      )
    ).toBeRejectedWithError('renderer failed');

    expect(downloadSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[data-element-png-export-host]')).toBeNull();
  });

  it('fails cleanly when the browser cannot encode the canvas', async () => {
    const canvas = {
      toBlob: (callback: BlobCallback) => callback(null),
    } as HTMLCanvasElement;

    await expectAsync(
      exportElementAsPng(
        source,
        { fileName: 'capture.png' },
        { download: downloadSpy, render: async () => canvas }
      )
    ).toBeRejectedWithError('La génération de l’image PNG a échoué.');

    expect(downloadSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[data-element-png-export-host]')).toBeNull();
  });
});
