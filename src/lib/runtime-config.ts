import { Capacitor } from '@capacitor/core';

export type AppTarget = 'hub' | 'client' | 'driver';

export const APP_TARGET: AppTarget = (() => {
  const raw = (import.meta.env.VITE_APP_TARGET as string | undefined)?.toLowerCase().trim();
  if (raw === 'client') return 'client';
  if (raw === 'driver') return 'driver';
  return 'hub';
})();

function sanitizeApiBaseUrl(raw?: string): string {
  let candidate = (raw || '').trim();
  if (!candidate || candidate === 'MY_API_URL') return '';

  try {
    let parsed = new URL(candidate);
    // Unwrap copy-pasted Google redirect links (e.g. https://www.google.com/url?sa=E&q=https%3A%2F%2F...)
    if (
      (parsed.hostname === 'www.google.com' || parsed.hostname === 'google.com') &&
      parsed.pathname === '/url'
    ) {
      const unwrapped = parsed.searchParams.get('q') || parsed.searchParams.get('url');
      if (!unwrapped) return '';
      candidate = unwrapped.trim();
      parsed = new URL(candidate);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

export const API_BASE_URL = sanitizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL as string | undefined
);

export function isNativeCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getDevicePlatform(): 'ios' | 'android' | 'web' {
  try {
    const p = Capacitor.getPlatform();
    if (p === 'ios') return 'ios';
    if (p === 'android') return 'android';
    return 'web';
  } catch {
    return 'web';
  }
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // On web browsers (dev/shared preview/PWA), always use same-origin relative paths
  // to avoid cross-origin cookie/CORS failures. Native Capacitor apps use API_BASE_URL.
  if (isNativeCapacitor() && API_BASE_URL) {
    return `${API_BASE_URL}${normalizedPath}`;
  }
  return normalizedPath;
}

export function telemetryWsUrl(token: string): string {
  if (isNativeCapacitor() && API_BASE_URL) {
    const url = new URL(API_BASE_URL);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${url.host}/ws/telemetry?token=${encodeURIComponent(token)}`;
  }
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${window.location.host}/ws/telemetry?token=${encodeURIComponent(token)}`;
}
