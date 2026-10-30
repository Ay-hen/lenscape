import { InjectionToken } from '@angular/core';

export interface AppEnv {
  production: boolean;
  /** Base URL of the Spring Boot REST API (no trailing slash). Overridden at deploy time. */
  apiBaseUrl: string;
  map: { tileUrl: string; attribution: string; defaultCenter: [number, number]; defaultZoom: number; maxZoom: number };
  /** 'nominatim' needs no key (public usage policy applies); 'local' is an offline Moroccan gazetteer. */
  geocoder: { provider: 'nominatim' | 'local'; baseUrl: string; countryCodes: string };
}

export const APP_ENV = new InjectionToken<AppEnv>('APP_ENV');
