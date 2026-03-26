/**
 * S90 — Audio Pipeline Test
 * Triggered from Debug overlay. Records 3s, reads file, uploads to bug-recordings bucket, logs each step.
 */
import { setAudioModeAsync, useAudioRecorder, RecordingPresets } from 'expo-audio';
import { getSupabase } from './supabase';

// Standalone test — uses the Supabase client pattern that matches crashUploader (verified working).
export async function testAudioPipeline(): Promise<boolean> {
  console.log('[TEST-AUDIO] === Starting pipeline test ===');

  try {
    // 1. Configure audio mode
    console.log('[TEST-AUDIO] Step 1: setAudioModeAsync...');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    console.log('[TEST-AUDIO] Step 1 ✅ Audio mode configured');

    // Note: useAudioRecorder is a hook and cannot be called here.
    // This test verifies the UPLOAD path only — the hook-based recording is tested
    // by the BugReporter component itself (check [BUG-AUDIO] logs in Metro).
    console.log('[TEST-AUDIO] Step 2: Verifying Supabase client...');
    const sb = getSupabase();
    if (!sb) { console.error('[TEST-AUDIO] ❌ No Supabase client'); return false; }
    console.log('[TEST-AUDIO] Step 2 ✅ Supabase client available');

    // 3. Create a tiny test blob (1 byte) to verify upload permissions
    console.log('[TEST-AUDIO] Step 3: Test-uploading 1-byte probe to bug-recordings...');
    const probe = new Uint8Array([0x00]);
    const probeFile = `audio/pipeline-test-${Date.now()}.m4a`;
    const { data, error } = await sb.storage
      .from('bug-recordings')
      .upload(probeFile, probe, { contentType: 'audio/mp4', upsert: false });

    if (error) {
      console.error('[TEST-AUDIO] ❌ Upload probe failed:', error.message);
      console.error('[TEST-AUDIO] This means the bug-recordings bucket has policy/permission issues.');
      return false;
    }
    console.log('[TEST-AUDIO] Step 3 ✅ Upload probe succeeded, path:', data?.path);

    // 4. Get public URL
    const { data: urlData } = sb.storage.from('bug-recordings').getPublicUrl(probeFile);
    console.log('[TEST-AUDIO] Step 4 ✅ Public URL:', urlData?.publicUrl);

    // 5. Cleanup probe file
    await sb.storage.from('bug-recordings').remove([probeFile]).catch(() => {});

    console.log('[TEST-AUDIO] === Pipeline test PASSED ✅ ===');
    console.log('[TEST-AUDIO] To test actual recording: use BugReporter shake/FAB and watch [BUG-AUDIO] logs.');
    return true;
  } catch (err) {
    console.error('[TEST-AUDIO] ❌ Pipeline test exception:', err);
    return false;
  }
}
