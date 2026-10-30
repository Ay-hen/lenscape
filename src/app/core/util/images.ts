/**
 * Deterministic generated placeholder artwork (initials avatars, abstract gradients) shown while a photographer has not uploaded their own images.
 * It is presentation only: it is never stored and never presented as a photographer's work.
 */
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const svg = (body: string, w: number, h: number) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;

/**
 * The default profile picture: a soft gradient (its hue is derived from the name, so different people look different) with a neutral person silhouette.
 * Everyone starts with it; customers and photographers can replace it with their own photo at any time and go back to it again.
 */
export function avatarImage(name: string, seed = name): string {
  const h = hash(seed || 'user') % 360;
  return svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 45% 52%)"/><stop offset="1" stop-color="hsl(${(h + 45) % 360} 50% 34%)"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="78" r="34" fill="rgba(255,255,255,.92)"/><path d="M34 200c0-40 29-70 66-70s66 30 66 70z" fill="rgba(255,255,255,.92)"/>`, 200, 200);
}

export function sceneImage(seed: string, w = 800, h = 600): string {
  const x = hash(seed);
  const hue = [14, 28, 200, 160, 340, 48][x % 6];
  const r = (n: number, m = 1) => ((hash(seed + n) % 1000) / 1000) * m;
  const blobs = Array.from({ length: 4 }, (_, i) => `<circle cx="${r(i, w)}" cy="${r(i + 9, h)}" r="${150 + r(i + 4, 260)}" fill="hsl(${hue + i * 18} 70% ${55 + i * 6}%)" opacity=".55"/>`).join('');
  return svg(`<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 22%)"/><stop offset="1" stop-color="hsl(${hue + 30} 45% 12%)"/></linearGradient><filter id="f"><feGaussianBlur stdDeviation="46"/></filter></defs><rect width="${w}" height="${h}" fill="url(#b)"/><g filter="url(#f)">${blobs}</g><rect x="${w * 0.1}" y="${h * 0.72}" width="${w * 0.8}" height="1" fill="rgba(255,255,255,.18)"/>`, w, h);
}
