import { NewCycleRegisterComponent } from '../components/new-cycle-register/new-cycle-register.component';
import { RegisterClientComponent } from '../components/register-client/register-client.component';
import { Client } from '../models/client';

describe('client home photo upload recovery', () => {
  const file = new File(['phone-photo'], 'maison.png', {
    type: 'image/png',
  });
  const files = { item: () => file } as unknown as FileList;

  function storageThatFinalizesThenReportsUnknown() {
    return {
      upload: jasmine
        .createSpy('upload')
        .and.returnValue(Promise.reject({ code: 'storage/unknown' })),
      storage: {
        ref: jasmine.createSpy('ref').and.returnValue({
          bucket: 'kank-test.appspot.com',
        }),
      },
    };
  }

  it('keeps a new-client house photo when Firebase confirms the object exists', async () => {
    const storage = storageThatFinalizesThenReportsUnknown();
    const component = new RegisterClientComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      storage as any
    );
    component.firstName = 'Marie';
    component.middleName = 'Kanku';
    component.lastName = 'Mbuyi';
    spyOn(window, 'alert');
    spyOn(console, 'error');

    await component.startHomePictureUpload(files);

    const uploadMetadata = storage.upload.calls.mostRecent().args[2];
    const downloadToken =
      uploadMetadata.customMetadata.firebaseStorageDownloadTokens;
    expect(component.homePictureAvatar.downloadURL).toContain(
      'kank-test.appspot.com'
    );
    expect(component.homePictureAvatar.downloadURL).toContain(
      encodeURIComponent(downloadToken)
    );
    expect(component.homePictureAvatar.size).toBe(String(file.size));
    expect(component.homePictureUploadError).toBe('');
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('keeps a new-cycle house photo when Firebase confirms the object exists', async () => {
    const storage = storageThatFinalizesThenReportsUnknown();
    const component = new NewCycleRegisterComponent(
      {} as any,
      { snapshot: { paramMap: { get: () => '75' } } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      storage as any
    );
    component.client = Object.assign(new Client(), {
      firstName: 'Marie',
      middleName: 'Kanku',
      lastName: 'Mbuyi',
    });
    spyOn(window, 'alert');
    spyOn(console, 'error');

    await component.startHomePictureUpload(files);

    const uploadMetadata = storage.upload.calls.mostRecent().args[2];
    const downloadToken =
      uploadMetadata.customMetadata.firebaseStorageDownloadTokens;
    expect(component.client.homePicture?.downloadURL).toContain(
      'kank-test.appspot.com'
    );
    expect(component.client.homePicture?.downloadURL).toContain(
      encodeURIComponent(downloadToken)
    );
    expect(component.client.homePicture?.size).toBe(String(file.size));
    expect(component.homePictureUploadError).toBe('');
    expect(window.alert).not.toHaveBeenCalled();
  });
});
