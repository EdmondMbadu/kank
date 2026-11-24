import { uploadAuditAudioBytes } from './audit-audio-upload.util';

describe('audit audio byte fallback', () => {
  it('materializes the full file and preserves its path, credentials reference, and metadata', async () => {
    const delegate = {};
    const reference = { _delegate: delegate, getDownloadURL: async () => 'audio-url' };
    const ref = jasmine.createSpy('ref').and.returnValue(reference);
    const send = jasmine.createSpy('uploadBytes').and.resolveTo({});
    const file = new File([new Uint8Array(632389)], 'Enregistrement d’appel.m4a');
    const metadata = { contentType: 'audio/mp4', customMetadata: { recordedAtSource: 'uploadTime' } };

    const result = await uploadAuditAudioBytes(
      { storage: { ref } } as any, 'audit-conversations/client-1/audio.m4a', file, metadata, send
    );

    expect(ref).toHaveBeenCalledOnceWith('audit-conversations/client-1/audio.m4a');
    expect(send).toHaveBeenCalledOnceWith(delegate, jasmine.any(Uint8Array), metadata);
    expect(send.calls.mostRecent().args[1].byteLength).toBe(632389);
    expect(await result.ref.getDownloadURL()).toBe('audio-url');
  });

  it('does not send empty or incomplete files', async () => {
    const send = jasmine.createSpy('uploadBytes');
    const file = new File(['audio'], 'audio.m4a');
    spyOn(file, 'arrayBuffer').and.resolveTo(new ArrayBuffer(0));

    await expectAsync(uploadAuditAudioBytes({} as any, 'audio', file, {}, send))
      .toBeRejectedWith(jasmine.objectContaining({ code: 'storage/cannot-slice-blob' }));
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps an unreadable local file as a failure', async () => {
    const send = jasmine.createSpy('uploadBytes');
    const file = new File(['audio'], 'audio.m4a');
    const error = new DOMException('File unavailable', 'NotReadableError');
    spyOn(file, 'arrayBuffer').and.rejectWith(error);

    await expectAsync(uploadAuditAudioBytes({} as any, 'audio', file, {}, send))
      .toBeRejectedWith(error);
    expect(send).not.toHaveBeenCalled();
  });
});
