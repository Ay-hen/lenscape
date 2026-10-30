import { GeoPoint } from '../models';

/** Small offline gazetteer of Moroccan cities. Used as a fallback/default when no geocoding provider is reachable. */
export const CITY_COORDS: Record<string, GeoPoint> = {
  Casablanca: { lat: 33.5731, lng: -7.5898 }, Rabat: { lat: 34.0209, lng: -6.8416 }, Marrakech: { lat: 31.6295, lng: -7.9811 },
  Tangier: { lat: 35.7595, lng: -5.834 }, Fes: { lat: 34.0331, lng: -5.0003 }, Agadir: { lat: 30.4278, lng: -9.5981 },
  Tetouan: { lat: 35.5785, lng: -5.3684 }, Essaouira: { lat: 31.5085, lng: -9.7595 }, Meknes: { lat: 33.8935, lng: -5.5547 }, Oujda: { lat: 34.6867, lng: -1.9114 },
};
export const CITIES = Object.keys(CITY_COORDS);
