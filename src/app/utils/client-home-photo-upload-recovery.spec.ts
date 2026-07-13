import { NewCycleRegisterComponent } from '../components/new-cycle-register/new-cycle-register.component';
import { RegisterClientComponent } from '../components/register-client/register-client.component';
import { Client } from '../models/client';

describe('client house photo upload flow', () => {
  const file = new File(['phone-photo'], 'maison.jpg', {
    type: 'image/jpeg',
  });
  const files = { item: () => file } as unknown as FileList;
  const firebaseDownloadURL =
    'https://firebasestorage.googleapis.com/real-server-token';

  function workingProfileStorage() {
    const getDownloadURL = jasmine
      .createSpy('getDownloadURL')
      .and.resolveTo(firebaseDownloadURL);
    const uploadSnapshot = {
      ref: { getDownloadURL },
      totalBytes: file.size,
    };
    const storage = {
      upload: jasmine.createSpy('upload').and.resolveTo(uploadSnapshot),
    };

    return { getDownloadURL, storage };
  }

  beforeEach(() => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:local-preview');
    spyOn(URL, 'revokeObjectURL');
    spyOn(window, 'alert');
    spyOn(console, 'error');
  });

  it('uses the profile upload pipeline for a new client house photo', async () => {
    const { getDownloadURL, storage } = workingProfileStorage();
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

    await component.startHomePictureUpload(files);

    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.upload.calls.mostRecent().args.length).toBe(2);
    expect(storage.upload.calls.mostRecent().args[1]).toBe(file);
    expect(getDownloadURL).toHaveBeenCalledTimes(1);
    expect(component.homePictureUrl).toBe(firebaseDownloadURL);
    expect(component.homePictureAvatar).toEqual({
      path: storage.upload.calls.mostRecent().args[0],
      downloadURL: firebaseDownloadURL,
      size: String(file.size),
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-preview');
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('uses the profile upload pipeline for a new-cycle house photo', async () => {
    const { getDownloadURL, storage } = workingProfileStorage();
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

    await component.startHomePictureUpload(files);

    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.upload.calls.mostRecent().args.length).toBe(2);
    expect(storage.upload.calls.mostRecent().args[1]).toBe(file);
    expect(getDownloadURL).toHaveBeenCalledTimes(1);
    expect(component.homePictureUrl).toBe(firebaseDownloadURL);
    expect(component.client.homePicture).toEqual({
      path: storage.upload.calls.mostRecent().args[0],
      downloadURL: firebaseDownloadURL,
      size: String(file.size),
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-preview');
    expect(window.alert).not.toHaveBeenCalled();
  });
});
