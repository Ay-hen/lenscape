import { AppEnv } from './app-config';
import { environment as base } from './environment';

export const environment: AppEnv = {
  ...base,
  production: true,
  // Placeholder: set the real API origin at deploy time with public/config.json (see README) or replace this value.
  apiBaseUrl: 'https://api.example.com',
};
