import { AppEnv } from './app-config';

/**
 * Default (development) environment. For production deployments replace values through
 * `src/environments` file replacement or the `public/runtime-config.json` mechanism described in the README.
 * NO secrets belong here: this file ships to the browser.
 */
export const environment: AppEnv = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
  map: {
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    defaultCenter: [31.79, -7.09],
    defaultZoom: 6,
    maxZoom: 19,
  },
  geocoder: { provider: 'nominatim', baseUrl: 'https://nominatim.openstreetmap.org', countryCodes: 'ma' },
};
