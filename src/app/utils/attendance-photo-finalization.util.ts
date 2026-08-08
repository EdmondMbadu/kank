/**
 * Keeps the critical attendance invariant explicit: a photo must finish
 * uploading before any attendance record is finalized.
 */
export async function uploadFirstThenFinalizeAttendance<TAttachment>(
  upload: () => Promise<TAttachment>,
  finalize: (attachment: TAttachment) => Promise<void>
): Promise<TAttachment> {
  const attachment = await upload();
  await finalize(attachment);
  return attachment;
}

export function attendanceFileFingerprint(file: File): string {
  return [file.name, file.size, file.lastModified, file.type].join('|');
}
