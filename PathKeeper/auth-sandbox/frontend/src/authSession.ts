// Lightweight JWT helper utilities (no external dependency)
// NOTE: This ONLY decodes base64 payload (no signature verification on client).

export interface DecodedToken {
  exp?: number; // seconds since epoch
  iat?: number;
  [k: string]: any;
}

export function decodeJwt(token: string): DecodedToken | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

export function getExpiry(token: string): number | null {
  const decoded = decodeJwt(token);
  if (decoded && typeof decoded.exp === 'number') return decoded.exp * 1000; // ms
  return null;
}

export function isExpired(token: string, skewSeconds = 0): boolean {
  const expMs = getExpiry(token);
  if (!expMs) return false; // treat missing exp as non-expiring for sandbox
  return Date.now() >= expMs - skewSeconds * 1000;
}

export function msUntilExpiry(token: string): number | null {
  const expMs = getExpiry(token);
  if (!expMs) return null;
  return expMs - Date.now();
}

export function scheduleLogout(token: string, onExpire: () => void, safetySkewMs = 500) {
  const ms = msUntilExpiry(token);
  if (ms == null) return { cancel: () => {} };
  if (ms <= 0) { onExpire(); return { cancel: () => {} }; }
  const id = setTimeout(onExpire, Math.max(0, ms - safetySkewMs));
  return { cancel: () => clearTimeout(id) };
}
