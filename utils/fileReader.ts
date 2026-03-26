/**
 * fileReader.ts — Robust local file reader for SDK 55.
 *
 * Method order: fetch+arrayBuffer FIRST (no expo dependency, most reliable),
 * then File.bytes() (SDK 55 API, but can hang on large files — size-checked),
 * then XHR (arraybuffer, iOS treats status=0 as local file success).
 *
 * Supabase Storage .upload() accepts: Blob | File | ArrayBuffer | string.
 * Pass bytes.buffer (ArrayBuffer) not bytes (Uint8Array) for best compatibility.
 */
import { File } from 'expo-file-system';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — above this File.bytes() may hang

/**
 * Read a local file URI as Uint8Array.
 * Tries 3 methods — stops at first success, logs every attempt.
 */
export const readFileAsBytes = async (uri: string): Promise<Uint8Array | null> => {
  if (!uri) {
    console.error('[FILE-READER] No URI provided');
    return null;
  }

  console.log('[FILE-READER] Reading:', uri.slice(-50));

  // Method 1: fetch() + arrayBuffer() — no expo dependency, most reliable on iOS
  try {
    console.log('[FILE-READER] Method 1: fetch + arrayBuffer...');
    const response = await fetch(uri);
    if (!response.ok) {
      console.error('[FILE-READER] Method 1: fetch status:', response.status);
    } else {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 100) {
        console.log('[FILE-READER] Method 1 ✅ bytes:', buffer.byteLength);
        return new Uint8Array(buffer);
      }
      console.warn('[FILE-READER] Method 1: buffer too small:', buffer.byteLength);
    }
  } catch (err: any) {
    console.error('[FILE-READER] Method 1 ❌:', err?.message || JSON.stringify(err) || 'unknown error');
  }

  // Method 2: SDK 55 File.bytes() — correct non-deprecated API
  // Size check first: File.bytes() may hang on large files (> 5MB audio)
  try {
    console.log('[FILE-READER] Method 2: new File(uri).bytes()...');
    const file = new File(uri);
    let shouldRead = true;
    try {
      const info = file.info();
      if (info.size && info.size > MAX_FILE_SIZE_BYTES) {
        console.warn('[FILE-READER] Method 2: file too large:', info.size, 'bytes — skipping File.bytes()');
        shouldRead = false;
      }
    } catch {}
    if (shouldRead) {
      const bytes = await file.bytes();
      if (bytes && bytes.length > 100) {
        console.log('[FILE-READER] Method 2 ✅ bytes:', bytes.length);
        return bytes;
      }
      console.warn('[FILE-READER] Method 2: result too small:', bytes?.length ?? 0);
    }
  } catch (err: any) {
    console.error(
      '[FILE-READER] Method 2 ❌:',
      err?.message || err?.code || JSON.stringify(err) || 'unknown error',
    );
  }

  // Method 3: XMLHttpRequest with arraybuffer responseType
  // XHR on iOS treats status=0 as success for local file:// URIs
  try {
    console.log('[FILE-READER] Method 3: XMLHttpRequest...');
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', uri, true);
      xhr.responseType = 'arraybuffer';
      xhr.timeout = 10000;
      xhr.onload = () => {
        // status 0 = local file success on iOS; 200 = normal success
        if (xhr.status === 0 || xhr.status === 200) {
          resolve(new Uint8Array(xhr.response as ArrayBuffer));
        } else {
          reject(new Error('XHR status: ' + xhr.status));
        }
      };
      xhr.onerror = () => reject(new Error('XHR network error'));
      xhr.ontimeout = () => reject(new Error('XHR timeout after 10s'));
      xhr.send();
    });
    if (bytes.length > 100) {
      console.log('[FILE-READER] Method 3 ✅ bytes:', bytes.length);
      return bytes;
    }
    console.warn('[FILE-READER] Method 3: too small:', bytes.length);
  } catch (err: any) {
    console.error('[FILE-READER] Method 3 ❌:', err?.message || JSON.stringify(err) || 'unknown error');
  }

  console.error('[FILE-READER] ❌ ALL 3 METHODS FAILED for:', uri.slice(-50));
  return null;
};
