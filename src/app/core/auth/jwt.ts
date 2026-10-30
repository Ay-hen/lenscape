/** Decodes (does NOT verify) a JWT payload. Verification is the backend's job. Replaces the `jwt-decode` dependency. */
export function jwtPayload(token: string): { sub?: string; exp?: number; [k: string]: unknown } | null {
  try {
    const part = token.split('.')[1]; if (!part) return null;
    const json = decodeURIComponent(atob(part.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    return JSON.parse(json);
  } catch { return null; }
}
export function isExpired(token: string): boolean { const p = jwtPayload(token); return !!p?.exp && p.exp * 1000 < Date.now(); }
