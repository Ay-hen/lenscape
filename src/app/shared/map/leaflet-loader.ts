import type * as Leaflet from 'leaflet';

let cache: Promise<typeof Leaflet> | null = null;

/** Lazily loads Leaflet (+ marker clustering) so the map code never lands in the initial bundle. */
export function loadLeaflet(): Promise<typeof Leaflet> {
  cache ??= (async () => {
    const L = ((await import('leaflet')) as unknown as { default: typeof Leaflet }).default;
    (window as unknown as { L: typeof Leaflet }).L = L; // leaflet.markercluster expects a global L
    await import('leaflet.markercluster');
    return L;
  })();
  cache.catch(() => (cache = null)); // allow retry after a failed chunk load
  return cache;
}
