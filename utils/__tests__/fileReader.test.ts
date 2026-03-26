/**
 * S96 — fileReader unit tests
 * Tests the 3-method fallback chain for reading local file URIs.
 * Method 1 uses SDK 55 File.bytes() — mocked via jest.mock('expo-file-system').
 */

const TEST_URI = 'file:///var/mobile/test-audio.m4a';
const TEST_BYTES = new Uint8Array(200).fill(42);

// ─── Mock expo-file-system File class ────────────────────────────────────────

const mockBytes = jest.fn();
const MockFile = jest.fn().mockImplementation(() => ({ bytes: mockBytes }));

jest.mock('expo-file-system', () => ({
  File: MockFile,
  Directory: jest.fn().mockImplementation(() => ({ exists: false, create: jest.fn(), list: jest.fn(() => []) })),
  Paths: { document: 'file:///docs/', cache: 'file:///cache/' },
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

const mockFetch = jest.fn();
const mockXHR = {
  open: jest.fn(),
  send: jest.fn(),
  responseType: '',
  timeout: 0,
  status: 0,
  response: null as ArrayBuffer | null,
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  ontimeout: null as (() => void) | null,
};
const MockXHRConstructor = jest.fn(() => mockXHR);

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = mockFetch;
  (global as any).XMLHttpRequest = MockXHRConstructor;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => { jest.restoreAllMocks(); });

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('readFileAsBytes', () => {
  it('returns null for empty URI', async () => {
    const { readFileAsBytes } = require('../fileReader');
    const result = await readFileAsBytes('');
    expect(result).toBeNull();
  });

  it('Method 1: returns Uint8Array when File.bytes() succeeds', async () => {
    mockBytes.mockResolvedValue(TEST_BYTES);

    const { readFileAsBytes } = require('../fileReader');
    const result = await readFileAsBytes(TEST_URI);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result!.length).toBe(200);
    expect(MockFile).toHaveBeenCalledWith(TEST_URI);
    expect(mockBytes).toHaveBeenCalled();
  });

  it('Method 1: falls through when File.bytes() returns too-small result', async () => {
    mockBytes.mockResolvedValue(new Uint8Array(5).fill(1)); // < 100 bytes
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(TEST_BYTES.buffer),
    });

    const { readFileAsBytes } = require('../fileReader');
    const result = await readFileAsBytes(TEST_URI);

    expect(result).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(TEST_URI);
  });

  it('Method 1: falls through on File.bytes() error, tries Method 2', async () => {
    mockBytes.mockRejectedValue(new Error('File not accessible'));
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(TEST_BYTES.buffer),
    });

    const { readFileAsBytes } = require('../fileReader');
    const result = await readFileAsBytes(TEST_URI);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockFetch).toHaveBeenCalledWith(TEST_URI);
  });

  it('Method 2: falls through on fetch error, tries Method 3 (XHR)', async () => {
    mockBytes.mockRejectedValue(new Error('FS fail'));
    mockFetch.mockRejectedValue(new Error('Network error'));

    mockXHR.send.mockImplementation(() => {
      mockXHR.status = 0; // iOS local file success
      mockXHR.response = TEST_BYTES.buffer as ArrayBuffer;
      if (mockXHR.onload) mockXHR.onload();
    });

    const { readFileAsBytes } = require('../fileReader');
    const result = await readFileAsBytes(TEST_URI);

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(MockXHRConstructor).toHaveBeenCalled();
    expect(mockXHR.open).toHaveBeenCalledWith('GET', TEST_URI, true);
    expect(mockXHR.responseType).toBe('arraybuffer');
  });

  it('Method 3: XHR status=200 also succeeds', async () => {
    mockBytes.mockRejectedValue(new Error('FS fail'));
    mockFetch.mockRejectedValue(new Error('Network error'));

    mockXHR.send.mockImplementation(() => {
      mockXHR.status = 200;
      mockXHR.response = TEST_BYTES.buffer as ArrayBuffer;
      if (mockXHR.onload) mockXHR.onload();
    });

    const { readFileAsBytes } = require('../fileReader');
    const result = await readFileAsBytes(TEST_URI);
    expect(result).not.toBeNull();
  });

  it('returns null when all 3 methods fail', async () => {
    mockBytes.mockRejectedValue(new Error('FS fail'));
    mockFetch.mockRejectedValue(new Error('Network error'));
    mockXHR.send.mockImplementation(() => {
      if (mockXHR.onerror) mockXHR.onerror();
    });

    const { readFileAsBytes } = require('../fileReader');
    const result = await readFileAsBytes(TEST_URI);
    expect(result).toBeNull();
  });

  it('logs every method attempt', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockBytes.mockRejectedValue(new Error('fail'));
    mockFetch.mockRejectedValue(new Error('fail'));
    mockXHR.send.mockImplementation(() => {
      if (mockXHR.onerror) mockXHR.onerror();
    });

    const { readFileAsBytes } = require('../fileReader');
    await readFileAsBytes(TEST_URI);

    const calls = consoleSpy.mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('Method 1'))).toBe(true);
    expect(calls.some((c) => c.includes('Method 2'))).toBe(true);
    expect(calls.some((c) => c.includes('Method 3'))).toBe(true);
  });

  it('logs URI slice for debugging', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockBytes.mockResolvedValue(TEST_BYTES);

    const { readFileAsBytes } = require('../fileReader');
    await readFileAsBytes(TEST_URI);

    const firstCall = consoleSpy.mock.calls[0][0] as string;
    expect(firstCall).toContain('[FILE-READER] Reading:');
  });
});
