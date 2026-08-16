import {
  isFirebaseNetworkError,
  withSingleFirebaseNetworkRetry,
} from './public-auth.service';

describe('public authentication reliability helpers', () => {
  it('identifies only the Firebase network error code', () => {
    expect(
      isFirebaseNetworkError({ code: 'auth/network-request-failed' })
    ).toBeTrue();
    expect(isFirebaseNetworkError({ code: 'auth/wrong-password' })).toBeFalse();
  });

  it('retries a network failure exactly once', async () => {
    let attempts = 0;
    const operation = jasmine.createSpy('operation').and.callFake(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw { code: 'auth/network-request-failed' };
      }
      return 'connected';
    });
    const wait = jasmine.createSpy('wait').and.resolveTo();

    const result = await withSingleFirebaseNetworkRetry(
      operation,
      () => false,
      wait
    );

    expect(result).toBe('connected');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it('does not retry credential failures', async () => {
    const error = { code: 'auth/invalid-credential' };
    const operation = jasmine
      .createSpy('operation')
      .and.rejectWith(error);

    await expectAsync(
      withSingleFirebaseNetworkRetry(operation, () => false, async () => {})
    ).toBeRejectedWith(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry while the browser is definitely offline', async () => {
    const error = { code: 'auth/network-request-failed' };
    const operation = jasmine
      .createSpy('operation')
      .and.rejectWith(error);

    await expectAsync(
      withSingleFirebaseNetworkRetry(operation, () => true, async () => {})
    ).toBeRejectedWith(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
