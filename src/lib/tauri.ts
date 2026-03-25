/**
 * Platform Integration Layer
 * 
 * Provides gateway auto-discovery and sidecar management across platforms:
 * - Tauri (desktop): Uses Rust backend commands for gateway management
 * - Capacitor (mobile): Scans local network for NullClaw gateways
 * - Browser: Probes localhost ports via fetch
 * 
 * Falls back gracefully when running as a regular web app.
 */

/** Check if we're running inside a Tauri webview */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Check if we're running inside a Capacitor native app */
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && 'Capacitor' in window &&
    (window as Record<string, unknown>).Capacitor !== undefined;
}

/** Check if we're running on a mobile device (Capacitor or mobile browser) */
export function isMobile(): boolean {
  return isCapacitor() || (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
}

/** Get the current platform identifier */
export function getPlatform(): 'tauri' | 'capacitor' | 'browser' {
  if (isTauri()) return 'tauri';
  if (isCapacitor()) return 'capacitor';
  return 'browser';
}

/**
 * Probe a single gateway URL to check if it's responding.
 * Returns true if the gateway responds with a healthy status.
 */
async function probeGateway(url: string, timeout: number = 2000): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(timeout)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Auto-discover the gateway URL by trying multiple addresses and ports.
 * 
 * Discovery order:
 * 1. Tauri: Ask Rust backend (sidecar management)
 * 2. Localhost ports (3000, 3001, 3333, 8080)
 * 3. Capacitor/Mobile: Scan common LAN gateway IPs (192.168.x.1, 10.0.x.1, etc.)
 * 4. User-saved gateway addresses from localStorage
 */
export async function discoverGateway(): Promise<string | null> {
  // 1. Tauri: Use Rust backend command
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const url = await invoke<string>('discover_gateway');
      return url;
    } catch {
      // Sidecar not found or not started, fall through to browser discovery
    }
  }

  // 2. Try localhost ports (works for desktop browser and Capacitor on same device)
  const ports = [3000, 3001, 3333, 8080];
  for (const port of ports) {
    if (await probeGateway(`http://127.0.0.1:${port}`)) {
      return `http://127.0.0.1:${port}`;
    }
  }

  // Also try "localhost" (different DNS resolution on some platforms)
  for (const port of ports) {
    if (await probeGateway(`http://localhost:${port}`)) {
      return `http://localhost:${port}`;
    }
  }

  // 3. Mobile/Capacitor: Scan LAN for gateways
  // On mobile, the gateway runs on the user's PC, so we need to find it on the LAN
  if (isCapacitor() || isMobile()) {
    const lanUrl = await scanLanForGateway();
    if (lanUrl) return lanUrl;
  }

  // 4. Check for user-saved gateway addresses
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('nullclaw_known_gateways');
    if (saved) {
      try {
        const gateways: string[] = JSON.parse(saved);
        for (const gw of gateways) {
          if (await probeGateway(gw)) return gw;
        }
      } catch {
        // Invalid saved data, ignore
      }
    }
  }

  return null;
}

/**
 * Scan local network for NullClaw gateways.
 * Tries common router/gateway IPs and subnet ranges.
 * Uses parallel probing for speed.
 */
async function scanLanForGateway(): Promise<string | null> {
  const port = 3000; // Default NullClaw gateway port
  
  // Common LAN gateway/host addresses to try
  const candidates: string[] = [
    // Common router gateway IPs (the PC is often nearby)
    '192.168.1.1', '192.168.0.1', '192.168.1.100', '192.168.0.100',
    '192.168.1.2', '192.168.0.2',
    '10.0.0.1', '10.0.0.2', '10.0.1.1',
    '172.16.0.1', '172.16.0.2',
    // WSL gateway IPs (common ranges)
    '172.30.80.1', '172.30.81.57', '172.17.0.1', '172.18.0.1',
    // Android emulator host aliases
    '10.0.2.2',
    // WSL default gateway (Windows host from inside WSL)
    '10.255.255.254',
  ];

  // Probe candidates in parallel batches of 4 for speed
  const batchSize = 4;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (ip) => {
        const url = `http://${ip}:${port}`;
        const found = await probeGateway(url, 3000);
        return found ? url : null;
      })
    );
    const found = results.find(r => r !== null);
    if (found) {
      // Save this gateway for future quick reconnection
      saveKnownGateway(found);
      return found;
    }
  }

  return null;
}

/**
 * Save a discovered gateway address for quick reconnection.
 * Stored in localStorage so the app can try it first next time.
 */
export function saveKnownGateway(url: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const saved = localStorage.getItem('nullclaw_known_gateways');
    const gateways: string[] = saved ? JSON.parse(saved) : [];
    if (!gateways.includes(url)) {
      gateways.unshift(url); // Add to front (most recent first)
      // Keep only the last 10 known gateways
      localStorage.setItem('nullclaw_known_gateways', JSON.stringify(gateways.slice(0, 10)));
    }
  } catch {
    // localStorage not available or corrupted
  }
}

/**
 * Get all known gateway addresses from localStorage.
 */
export function getKnownGateways(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const saved = localStorage.getItem('nullclaw_known_gateways');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Start the gateway sidecar (Tauri only).
 * Returns the gateway URL or null if not in Tauri.
 */
export async function startGateway(port: number = 3000): Promise<string | null> {
  if (!isTauri()) return null;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('start_gateway', { port });
  } catch (e) {
    console.error('[Tauri] Failed to start gateway:', e);
    return null;
  }
}

/**
 * Stop the gateway sidecar (Tauri only).
 */
export async function stopGateway(): Promise<void> {
  if (!isTauri()) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('stop_gateway');
  } catch (e) {
    console.error('[Tauri] Failed to stop gateway:', e);
  }
}

/**
 * Check if the gateway sidecar is running (Tauri only).
 */
export async function isGatewayRunning(): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean>('gateway_status');
  } catch {
    return false;
  }
}

/**
 * Listen for gateway events from Tauri backend.
 */
export async function onGatewayStarted(callback: (url: string) => void): Promise<(() => void) | null> {
  if (!isTauri()) return null;

  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<string>('gateway-started', (event) => {
      callback(event.payload);
    });
    return unlisten;
  } catch {
    return null;
  }
}

/**
 * Listen for gateway error events from Tauri backend.
 */
export async function onGatewayError(callback: (error: string) => void): Promise<(() => void) | null> {
  if (!isTauri()) return null;

  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<string>('gateway-error', (event) => {
      callback(event.payload);
    });
    return unlisten;
  } catch {
    return null;
  }
}
