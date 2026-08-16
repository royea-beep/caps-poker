/**
 * Crash Uploader — uploads crash video + metadata to Supabase Storage.
 * Bucket: crash-recordings (public, anon insert)
 */
import { Platform } from 'react-native';
import { debugLog } from '../components/DebugOverlay';
import { getSupabase } from './supabase';
import { readFileAsBytes } from './fileReader';
import { getDeviceId } from './leaderboard';

export interface CrashMeta {
  build: string;
  version: string;
  device: string;
  lastStep: string;
  crashError?: string;
  componentStack?: string;
}

export async function uploadCrashReport(
  videoUri: string | null,
  debugLogs: string[],
  meta: CrashMeta,
): Promise<string | null> {
  try {
    debugLog('📤 uploading crash report...');
    const supabase = getSupabase();
    if (!supabase) { debugLog('📤 no Supabase', 'warn'); return null; }

    let videoUrl: string | null = null;

    if (videoUri && Platform.OS !== 'web') {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `crash-${timestamp}.mp4`;
        const bytes = await readFileAsBytes(videoUri);
        if (!bytes) throw new Error('readFileAsBytes returned null');
        const { error } = await supabase.storage
          .from('crash-recordings')
          .upload(fileName, bytes.buffer as ArrayBuffer, { contentType: 'video/mp4', upsert: false });
        if (!error) {
          const { data: urlData } = supabase.storage
            .from('crash-recordings')
            .getPublicUrl(fileName);
          videoUrl = urlData?.publicUrl ?? null;
          if (videoUrl) debugLog(`📤 video URL: ${videoUrl.slice(-30)}`);
        } else {
          debugLog(`📤 video upload error: ${error.message}`, 'warn');
        }
      } catch (uploadErr) {
        debugLog(`📤 video upload failed: ${uploadErr}`, 'warn');
      }
    }

    // Always insert crash log (even without video)
    // FLOOD 2026-08-16 — this path carries NO session_id, so it was outside every limit, and it
    // is the path that produced the historical 71-in-a-day peak. device_id brings it inside.
    const deviceId = await getDeviceId();
    await supabase.from('bug_reports').insert({
      title: `[CRASH] ${meta.lastStep}`,
      device_info: { device_id: deviceId, platform: Platform.OS, source: 'crash_auto' },
      description: `${meta.crashError ?? 'unknown'}\n\nLast 20 debug logs:\n${debugLogs.slice(-20).join('\n')}`,
      url: 'crashDetector/auto',
      report_type: 'text',
      screenshot_url: videoUrl,
      metadata: {
        ...meta,
        videoUrl,
        debugLogs: debugLogs.slice(-20),
        timestamp: new Date().toISOString(),
      },
    });

    debugLog('📤 crash report saved ✅');
    return videoUrl;
  } catch (e) {
    debugLog(`📤 upload crashed: ${e}`, 'error');
    return null;
  }
}
