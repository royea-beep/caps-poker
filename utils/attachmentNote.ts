/**
 * THE LINE A BUG REPORT CARRIES WHEN AN ATTACHMENT DID NOT ARRIVE.
 *
 * REPORTER-AND-BOARD4 2026-09-08. Measured across all 252 rows before this existed: 7 of 36 rows
 * flagged `has_video` carried NO url at all — the 5s upload returned null and the report filed
 * anyway — and 15 of 42 lost the audio. One report is titled "Again no audio". A tester who
 * submits evidence, is told "Report sent ✅", and loses it does not send a second report.
 *
 * ⚠️ IT LIVES IN ITS OWN MODULE ON PURPOSE. It is a pure function and belongs where it can be
 * tested: importing it from components/BugReporter.tsx drags in expo-audio, expo-file-system and
 * react-native-view-shot, none of which jest can transform.
 *
 * ⚠️ AND THE NOTE GOES INTO `description`, not only into metadata. description is the one field
 * telegram-bot-handler and whatsapp-bot-handler already render, and Edge Functions cannot be
 * deployed from this lane. A note nobody renders is the same silence in a different column.
 */
export function attachmentNote(a: {
  framesCaptured: number;
  framesUploaded: number;
  audioCaptured: boolean;
  audioUploaded: boolean;
}): string | null {
  const lost: string[] = [];
  if (a.framesCaptured > a.framesUploaded) {
    lost.push(`${a.framesCaptured - a.framesUploaded} of ${a.framesCaptured} screen frames`);
  }
  if (a.audioCaptured && !a.audioUploaded) lost.push('the audio');
  if (!lost.length) return null;
  return `[attachment incomplete — ${lost.join(' and ')} failed to upload]`;
}
