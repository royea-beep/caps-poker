/**
 * THE REPORT MUST SAY WHEN AN ATTACHMENT DID NOT ARRIVE.
 *
 * REPORTER-AND-BOARD4 2026-09-08. Measured across all 252 rows before the change: 7 of 36 rows
 * flagged has_video carried NO url at all, and 15 of 42 lost the audio. The 5s upload returned
 * null and the report filed anyway, so a tester saw "Report sent ✅" over an empty envelope.
 *
 * These cases pin the SEMANTICS of the note that now goes into `description` — the one field the
 * Telegram and WhatsApp handlers already render, which is why it goes there and not only into
 * metadata. A note nobody renders is the same silence in a different column.
 *
 * ⚠️ The upload path itself (uploadFrames -> uploadFrame -> Supabase storage) is NATIVE-ONLY:
 * uploadFrame returns null on web by design, so it cannot be exercised here or by a browser rig.
 * That half is proven end to end through the built app instead, and the limit is stated rather
 * than papered over.
 */
import { attachmentNote } from '../attachmentNote';

describe('attachmentNote — silence ends here', () => {
  it('says nothing when everything arrived', () => {
    expect(attachmentNote({ framesCaptured: 10, framesUploaded: 10, audioCaptured: true, audioUploaded: true }))
      .toBeNull();
  });

  it('says nothing when there was nothing to attach', () => {
    expect(attachmentNote({ framesCaptured: 0, framesUploaded: 0, audioCaptured: false, audioUploaded: false }))
      .toBeNull();
  });

  it('names how many frames were lost, not just that some were', () => {
    const note = attachmentNote({ framesCaptured: 10, framesUploaded: 3, audioCaptured: false, audioUploaded: false });
    expect(note).toBe('[attachment incomplete — 7 of 10 screen frames failed to upload]');
  });

  it('reports the total loss that used to be silent', () => {
    // the exact shape of the 7 rows that carried has_video with a null url
    const note = attachmentNote({ framesCaptured: 10, framesUploaded: 0, audioCaptured: false, audioUploaded: false });
    expect(note).toContain('10 of 10 screen frames');
  });

  it('reports lost audio — report #15 was literally titled "Again no audio"', () => {
    expect(attachmentNote({ framesCaptured: 4, framesUploaded: 4, audioCaptured: true, audioUploaded: false }))
      .toBe('[attachment incomplete — the audio failed to upload]');
  });

  it('reports both losses in one line', () => {
    const note = attachmentNote({ framesCaptured: 6, framesUploaded: 1, audioCaptured: true, audioUploaded: false })!;
    expect(note).toContain('5 of 6 screen frames');
    expect(note).toContain('the audio');
  });

  it('never claims a loss when MORE arrived than were counted (defensive)', () => {
    expect(attachmentNote({ framesCaptured: 2, framesUploaded: 5, audioCaptured: false, audioUploaded: false }))
      .toBeNull();
  });
});
