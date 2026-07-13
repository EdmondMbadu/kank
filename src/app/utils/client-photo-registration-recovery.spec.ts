import { of } from 'rxjs';
import { NewCycleRegisterComponent } from '../components/new-cycle-register/new-cycle-register.component';
import { RegisterClientComponent } from '../components/register-client/register-client.component';
import { Client } from '../models/client';

describe('registration photo recovery wiring', () => {
  const file = new File(['iphone-photo'], 'photo.jpg', {
    type: 'image/jpeg',
  });
  const files = { item: () => file } as unknown as FileList;
  const recoveredURL = 'https://firebase.test/recovered-photo';

  function storageThatCommitsThenReportsUnknown() {
    return {
      upload: jasmine
        .createSpy('upload')
        .and.rejectWith({ code: 'storage/unknown' }),
    };
  }

  function recoveryFunctions() {
    return {
      httpsCallable: jasmine.createSpy('httpsCallable').and.returnValue(() =>
        of({
          exists: true,
          downloadURL: recoveredURL,
          size: String(file.size),
        })
      ),
    };
  }

  beforeEach(() => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:iphone-preview');
    spyOn(URL, 'revokeObjectURL');
    spyOn(window, 'alert');
    spyOn(console, 'error');
  });

  it('recovers an iPhone house photo during new-client registration', async () => {
    const storage = storageThatCommitsThenReportsUnknown();
    const functions = recoveryFunctions();
    const component = new RegisterClientComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      functions as any,
      storage as any
    );
    component.firstName = 'Marie';
    component.middleName = 'Kanku';
    component.lastName = 'Mbuyi';

    await component.startHomePictureUpload(files);

    expect(component.homePictureUrl).toBe(recoveredURL);
    expect(component.homePictureAvatar.downloadURL).toBe(recoveredURL);
    expect(component.homePictureUploading).toBeFalse();
    expect(functions.httpsCallable).toHaveBeenCalledWith(
      'recoverClientPhotoUpload'
    );
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('recovers an iPhone profile photo during new-client registration', async () => {
    const storage = storageThatCommitsThenReportsUnknown();
    const functions = recoveryFunctions();
    const component = new RegisterClientComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      functions as any,
      storage as any
    );
    component.firstName = 'Marie';
    component.middleName = 'Kanku';
    component.lastName = 'Mbuyi';

    await component.startUpload(files);

    expect(component.url).toBe(recoveredURL);
    expect(component.avatar.downloadURL).toBe(recoveredURL);
    expect(functions.httpsCallable).toHaveBeenCalledWith(
      'recoverClientPhotoUpload'
    );
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('recovers an iPhone house photo during new-cycle registration', async () => {
    const storage = storageThatCommitsThenReportsUnknown();
    const functions = recoveryFunctions();
    const component = new NewCycleRegisterComponent(
      {} as any,
      { snapshot: { paramMap: { get: () => '75' } } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      functions as any,
      storage as any
    );
    component.client = Object.assign(new Client(), {
      firstName: 'Marie',
      middleName: 'Kanku',
      lastName: 'Mbuyi',
    });

    await component.startHomePictureUpload(files);

    expect(component.homePictureUrl).toBe(recoveredURL);
    expect(component.client.homePicture?.downloadURL).toBe(recoveredURL);
    expect(component.homePictureUploading).toBeFalse();
    expect(functions.httpsCallable).toHaveBeenCalledWith(
      'recoverClientPhotoUpload'
    );
    expect(window.alert).not.toHaveBeenCalled();
  });
});
