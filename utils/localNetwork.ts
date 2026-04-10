/**
 * localNetwork.ts — S99
 * IP discovery utilities for Local MP:
 *  - getLocalIP(): get device's real LAN IP
 *  - startDiscoveryServer(): TCP discovery on port 41234
 *  - findLocalHost(): subnet scan to auto-discover host
 */
import { Platform } from 'react-native';

export const DISCOVERY_PORT = 41234;
const DISCOVERY_PREFIX = 'CAPS:';
const SCAN_TIMEOUT_MS = 400;
const SCAN_BATCH_SIZE = 40;

function getTcpSocket() {
  if (Platform.OS === 'web') throw new Error('TCP not available on web');
  return require('react-native-tcp-socket').default;
}

// ─── Get real device LAN IP ────────────────────────────────────────────────

/**
 * Gets the device's real LAN IP by creating a TCP connection to an
 * external host (8.8.8.8). The OS assigns a local address before the
 * connection attempt — we read it from the socket.
 * Falls back to '' if unavailable (web / no WiFi).
 */
export async function getLocalIP(): Promise<string> {
  if (Platform.OS === 'web') return '';

  return new Promise((resolve) => {
    let resolved = false;
    const done = (ip: string) => {
      if (!resolved) {
        resolved = true;
        resolve(ip);
      }
    };

    const fallbackTimer = setTimeout(() => done(''), 3000);

    try {
      const TcpSocket = getTcpSocket();
      const socket = TcpSocket.createConnection({
        host: '8.8.8.8',
        port: 53,
        timeout: 2500,
      });

      const readAddr = () => {
        clearTimeout(fallbackTimer);
        const addr = socket.address();
        const ip: string = (addr as any)?.address ?? '';
        try { socket.destroy(); } catch {}
        done(ip);
      };

      socket.on('connect', readAddr);
      socket.on('error', readAddr);
      socket.on('timeout', readAddr);
    } catch {
      clearTimeout(fallbackTimer);
      done('');
    }
  });
}

// ─── Discovery server (runs on host) ─────────────────────────────────────────

/**
 * Creates a TCP discovery server on DISCOVERY_PORT.
 * When any client connects, sends "CAPS:{roomCode}\n" then closes.
 * Returns the server handle — call stopDiscoveryServer() to shut it down.
 */
export function startDiscoveryServer(roomCode: string): any {
  if (Platform.OS === 'web') return null;

  try {
    const TcpSocket = getTcpSocket();
    const srv = TcpSocket.createServer((socket: any) => {
      try {
        socket.write(`${DISCOVERY_PREFIX}${roomCode}\n`);
        socket.end();
      } catch {}
    });
    srv.listen({ port: DISCOVERY_PORT, host: '0.0.0.0' }, () => {});
    srv.on('error', () => {}); // port may be taken — silent fail
    return srv;
  } catch {
    return null;
  }
}

export function stopDiscoveryServer(srv: any): void {
  if (!srv) return;
  try { srv.close(); } catch {}
}

// ─── Subnet scan (runs on guest) ─────────────────────────────────────────────

/** Returns first non-null result from a set of promises. */
function raceFirst<T>(promises: Promise<T | null>[]): Promise<T | null> {
  return new Promise((resolve) => {
    let pending = promises.length;
    if (pending === 0) { resolve(null); return; }
    for (const p of promises) {
      p.then((result) => {
        if (result !== null) resolve(result);
        else if (--pending === 0) resolve(null);
      }).catch(() => {
        if (--pending === 0) resolve(null);
      });
    }
  });
}

/**
 * Try connecting to one IP's discovery port.
 * If the server replies with "CAPS:{roomCode}", returns the IP.
 */
function probeIP(ip: string, roomCode: string): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: string | null) => {
      if (!done) { done = true; resolve(result); }
    };

    const timer = setTimeout(() => finish(null), SCAN_TIMEOUT_MS);

    try {
      const TcpSocket = getTcpSocket();
      const socket = TcpSocket.createConnection({
        host: ip,
        port: DISCOVERY_PORT,
        timeout: SCAN_TIMEOUT_MS,
      });
      let buf = '';

      socket.on('data', (d: any) => {
        buf += typeof d === 'string' ? d : d.toString('utf8');
        if (buf.includes('\n')) {
          clearTimeout(timer);
          try { socket.destroy(); } catch {}
          const line = buf.split('\n')[0].trim();
          finish(line === `${DISCOVERY_PREFIX}${roomCode}` ? ip : null);
        }
      });

      socket.on('error', () => {
        clearTimeout(timer);
        try { socket.destroy(); } catch {}
        finish(null);
      });

      socket.on('close', () => {
        clearTimeout(timer);
        finish(null);
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/**
 * Scan the local subnet for a host broadcasting the given room code.
 * Requires the guest device's own IP to determine the subnet.
 * Returns the host IP if found, null otherwise.
 */
export async function findLocalHost(
  roomCode: string,
  onProgress?: (checked: number, total: number) => void
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const localIP = await getLocalIP();
  if (!localIP) return null;

  const parts = localIP.split('.');
  if (parts.length !== 4) return null;

  const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const candidates: string[] = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `${subnet}.${i}`;
    if (ip !== localIP) candidates.push(ip);
  }

  // Common router/device positions first (faster discovery)
  const priorityIps = [1, 100, 101, 2, 254, 50, 10, 20].map(i => `${subnet}.${i}`);
  const prioritySet = new Set(priorityIps);
  const ordered = [
    ...priorityIps.filter(ip => ip !== localIP),
    ...candidates.filter(ip => !prioritySet.has(ip)),
  ];

  const total = ordered.length;
  for (let b = 0; b < ordered.length; b += SCAN_BATCH_SIZE) {
    const batch = ordered.slice(b, b + SCAN_BATCH_SIZE);
    const found = await raceFirst(batch.map(ip => probeIP(ip, roomCode)));
    onProgress?.(Math.min(b + SCAN_BATCH_SIZE, total), total);
    if (found) return found;
  }

  return null;
}

/**
 * User-facing error messages for Local MP.
 */
export const MP_ERRORS = {
  NO_WIFI: 'Make sure both devices are on the same WiFi network',
  CONNECTION_TIMEOUT: 'Could not find host. Check the room code and try again.',
  HOST_LEFT: 'Host disconnected. Game ended.',
  NETWORK_ERROR: 'Connection lost. Both devices must be on the same WiFi.',
  ROOM_FULL: 'Room is full. Ask the host for a new game.',
  WRONG_CODE: 'Wrong room code. Double-check with the host.',
  SERVER_START_FAIL: 'Could not start server. Restart the app and try again.',
} as const;
