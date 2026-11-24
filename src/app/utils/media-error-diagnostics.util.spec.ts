import { mediaErrorServerDetails } from './media-error-diagnostics.util';

describe('media error server details', () => {
  it('shows the HTTP status and server message hidden by storage/unknown', () => {
    expect(mediaErrorServerDetails({
      code: 'storage/unknown', status: 412,
      customData: { serverResponse: '{"error":{"message":"A required permission is missing."}}' },
    })).toBe('HTTP 412 : A required permission is missing.');
  });

  it('supports legacy server responses and removes credentials and private links', () => {
    const details = mediaErrorServerDetails({
      status_: 400,
      serverResponse: 'Rejected https://example.com/file?token=secret-url Bearer secret-auth token=secret-token',
    });
    expect(details).toContain('HTTP 400');
    expect(details).toContain('[URL removed]');
    expect(details).not.toContain('secret-');
  });

  it('distinguishes no HTTP response from an error with no status detail', () => {
    expect(mediaErrorServerDetails({ status: 0 })).toBe('Aucune réponse HTTP');
    expect(mediaErrorServerDetails({ code: 'storage/unknown' })).toBe('');
  });
});
