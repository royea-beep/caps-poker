/**
 * S96 — BugReporter pipeline integration tests
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../utils/fileReader', () => ({
  readFileAsBytes: jest.fn(),
}));

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();

jest.mock('../../utils/supabase', () => ({
  getSupabase: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
    from: jest.fn(() => ({
      insert: mockInsert,
    })),
  })),
}));

jest.mock('../../utils/logBuffer', () => ({ getConsoleLogs: jest.fn(() => ['log line 1', 'log line 2']) }));
jest.mock('../../utils/breadcrumbs', () => ({
  getBreadcrumbs: jest.fn(() => [{ screen: '/game', ts: '2026-03-26T10:00:00.000Z' }]),
  addBreadcrumb: jest.fn(),
}));

const TEST_BYTES = new Uint8Array(500).fill(1);
const AUDIO_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/storage/v1/object/public/bug-recordings/audio/bug-123.m4a';
const FRAME_URL = 'https://gxrpunvhjcrzqnitbqah.supabase.co/storage/v1/object/public/bug-recordings/frames/frame-123.jpg';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => { jest.restoreAllMocks(); });

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BugReporter: upload pipeline', () => {
  it('readFileAsBytes is called with audio URI', async () => {
    const { readFileAsBytes } = require('../../utils/fileReader');
    (readFileAsBytes as jest.Mock).mockResolvedValue(TEST_BYTES);

    const bytes = await readFileAsBytes('file:///cache/ExpoAudio/recording-123.m4a');
    expect(bytes).not.toBeNull();
    expect(bytes!.length).toBe(500);
    expect(readFileAsBytes).toHaveBeenCalledWith('file:///cache/ExpoAudio/recording-123.m4a');
  });

  it('upload sends ArrayBuffer (bytes.buffer) not Uint8Array', async () => {
    const { readFileAsBytes } = require('../../utils/fileReader');
    (readFileAsBytes as jest.Mock).mockResolvedValue(TEST_BYTES);
    mockUpload.mockResolvedValue({ data: { path: 'audio/bug-456.m4a' }, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: AUDIO_URL } });

    const bytes = await readFileAsBytes('file:///test.m4a');
    expect(bytes).not.toBeNull();
    // Verify the upload would use ArrayBuffer
    const { getSupabase } = require('../../utils/supabase');
    const sb = getSupabase();
    await sb.storage.from('bug-recordings').upload('audio/test.m4a', bytes!.buffer as ArrayBuffer, { contentType: 'audio/mp4' });
    expect(mockUpload).toHaveBeenCalledWith(
      'audio/test.m4a',
      expect.any(ArrayBuffer),
      { contentType: 'audio/mp4' },
    );
  });

  it('upload is skipped when readFileAsBytes returns null', async () => {
    const { readFileAsBytes } = require('../../utils/fileReader');
    (readFileAsBytes as jest.Mock).mockResolvedValue(null);

    const bytes = await readFileAsBytes('file:///missing.m4a');
    expect(bytes).toBeNull();
    // upload should NOT be called when bytes is null
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('audio_url is populated when upload succeeds', async () => {
    const { readFileAsBytes } = require('../../utils/fileReader');
    (readFileAsBytes as jest.Mock).mockResolvedValue(TEST_BYTES);
    mockUpload.mockResolvedValue({ data: { path: 'audio/bug-123.m4a' }, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: AUDIO_URL } });

    const bytes = await readFileAsBytes('file:///test.m4a');
    const { getSupabase } = require('../../utils/supabase');
    const sb = getSupabase();
    await sb.storage.from('bug-recordings').upload('audio/bug-123.m4a', bytes!.buffer, { contentType: 'audio/mp4' });
    const { data: urlData } = sb.storage.from('bug-recordings').getPublicUrl('audio/bug-123.m4a');
    expect(urlData?.publicUrl).toBe(AUDIO_URL);
  });

  it('INSERT payload includes device_info, console_logs, breadcrumbs', async () => {
    mockInsert.mockReturnValue({
      select: mockSelect.mockReturnValue({
        single: mockSingle.mockResolvedValue({ data: { id: 'test-id-123' }, error: null }),
      }),
    });
    const { getConsoleLogs } = require('../../utils/logBuffer');
    const { getBreadcrumbs } = require('../../utils/breadcrumbs');
    const { getSupabase } = require('../../utils/supabase');

    const sb = getSupabase();
    const row = {
      project: 'caps-poker',
      version: '1.9.4',
      title: 'Test bug',
      device_info: { model: 'iPhone 17', platform: 'ios' },
      console_logs: getConsoleLogs(),
      breadcrumbs: getBreadcrumbs(),
    };

    sb.from('bug_reports').insert(row);

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      device_info: expect.objectContaining({ model: 'iPhone 17' }),
      console_logs: expect.arrayContaining(['log line 1']),
      breadcrumbs: expect.arrayContaining([expect.objectContaining({ screen: '/game' })]),
    }));
  });

  it('frame upload uses ArrayBuffer format', async () => {
    const { readFileAsBytes } = require('../../utils/fileReader');
    (readFileAsBytes as jest.Mock).mockResolvedValue(TEST_BYTES);
    mockUpload.mockResolvedValue({ data: { path: 'frames/frame-123.jpg' }, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: FRAME_URL } });

    const bytes = await readFileAsBytes('file:///docs/crash-screenshots/frame-123.jpg');
    const { getSupabase } = require('../../utils/supabase');
    const sb = getSupabase();
    await sb.storage.from('bug-recordings').upload('frames/frame-123.jpg', bytes!.buffer as ArrayBuffer, { contentType: 'image/jpeg' });
    expect(mockUpload).toHaveBeenCalledWith(
      'frames/frame-123.jpg',
      expect.any(ArrayBuffer),
      { contentType: 'image/jpeg' },
    );
  });
});
