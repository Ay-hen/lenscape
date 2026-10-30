import { AppEnv } from './app-config';

type Partial2<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/**
 * Optional deploy-time overrides, read from `config.json` next to index.html (see `public/config.example.json`).
 * Lets one build artifact run against different API hosts / map providers without rebuilding. The file is PUBLIC —
 * never put secrets in it. Unknown keys are ignored; a missing or invalid file silently falls back to the build-time environment.
 */
export async function loadRuntimeConfig(base: AppEnv, fetchFn: typeof fetch = fetch): Promise<AppEnv> {
  let raw: Partial2<AppEnv>;
  try {
    const res = await fetchFn('config.json', { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return base; // SPA hosts answer 200 + index.html for unknown files
    raw = (await res.json()) as Partial2<AppEnv>;
  } catch { return base; }
  if (!raw || typeof raw !== 'object') return base;

  const env: AppEnv = { ...base, map: { ...base.map }, geocoder: { ...base.geocoder } };
  if (typeof raw.apiBaseUrl === 'string' && /^https?:\/\//.test(raw.apiBaseUrl)) env.apiBaseUrl = raw.apiBaseUrl.replace(/\/+$/, '');
  const m = raw.map; if (m) {
    if (typeof m.tileUrl === 'string' && m.tileUrl.startsWith('https://')) env.map.tileUrl = m.tileUrl;
    if (typeof m.attribution === 'string') env.map.attribution = m.attribution;
    if (Array.isArray(m.defaultCenter) && m.defaultCenter.length === 2 && m.defaultCenter.every(n => typeof n === 'number')) env.map.defaultCenter = [m.defaultCenter[0], m.defaultCenter[1]];
    if (typeof m.defaultZoom === 'number') env.map.defaultZoom = m.defaultZoom;
  }
  const g = raw.geocoder; if (g) {
    if (g.provider === 'nominatim' || g.provider === 'local') env.geocoder.provider = g.provider;
    if (typeof g.baseUrl === 'string' && g.baseUrl.startsWith('https://')) env.geocoder.baseUrl = g.baseUrl.replace(/\/+$/, '');
    if (typeof g.countryCodes === 'string') env.geocoder.countryCodes = g.countryCodes;
  }
  return env;
}
