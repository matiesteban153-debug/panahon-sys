/**
 * Panahon Pulse — Fichaje telemetry
 *
 * Wraps trackEvent() with rich device/session context collected once per page load.
 * Every fichaje event automatically carries: session_id, user_agent, OS, browser,
 * network state, screen size, timezone, and elapsed time since page load.
 *
 * Usage: trackFichajeEvento({ evento: "gps_concedido", empresa_id, metadata: {...} })
 */

import { trackEvent, type TrackEventParams } from "./telemetry";

// ── Session context ────────────────────────────────────────────────────────────
// Generated once per page load, persists in memory only.
export const PULSE_SESSION_ID: string = crypto.randomUUID();
const PULSE_PAGE_LOAD: number = Date.now();
export const PANAHON_VERSION = "1.0.0";

// ── Device context (collected once, cached) ────────────────────────────────────
let _deviceContext: Record<string, unknown> | null = null;

function buildDeviceContext(): Record<string, unknown> {
  const ua = navigator.userAgent;
  const isIOS     = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile  = isIOS || isAndroid || /Mobi/i.test(ua);

  const os =
    isIOS       ? "iOS"
    : isAndroid ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Macintosh|Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown";

  const browser =
    /Edg/.test(ua)                          ? "Edge"
    : /Chrome/.test(ua)                     ? "Chrome"
    : /Firefox/.test(ua)                    ? "Firefox"
    : /Safari/.test(ua) && !/Chrome/.test(ua) ? "Safari"
    : "Other";

  const connection = (navigator as any).connection;

  return {
    session_id:         PULSE_SESSION_ID,
    panahon_version:    PANAHON_VERSION,
    user_agent:         ua,
    os,
    browser,
    is_mobile:          isMobile,
    screen:             `${window.screen.width}x${window.screen.height}`,
    language:           navigator.language,
    online:             navigator.onLine,
    connection_type:    connection?.effectiveType ?? null,
    connection_downlink: connection?.downlink    ?? null,
    timezone:           Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function getDeviceContext(): Record<string, unknown> {
  if (!_deviceContext) _deviceContext = buildDeviceContext();
  return _deviceContext;
}

// ── Elapsed time helper ────────────────────────────────────────────────────────
export function elapsedMs(): number {
  return Date.now() - PULSE_PAGE_LOAD;
}

// ── Public tracker ─────────────────────────────────────────────────────────────
export type FichajeEventoParams = Omit<TrackEventParams, "metadata"> & {
  metadata?: Record<string, unknown>;
};

export function trackFichajeEvento(params: FichajeEventoParams): void {
  trackEvent({
    ...params,
    metadata: {
      // Device + session context (fixed per page load)
      ...getDeviceContext(),
      // Per-event dynamic fields
      timestamp:             new Date().toISOString(),
      tiempo_desde_carga_ms: elapsedMs(),
      // Caller-supplied metadata (overrides defaults if same key)
      ...params.metadata,
    },
  });
}
