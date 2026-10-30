import { bootstrapApplication } from '@angular/platform-browser';
import { buildAppConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './app/core/config/environment';
import { loadRuntimeConfig } from './app/core/config/runtime-config';

// Build-time environment, optionally overridden by a public `config.json` at deploy time.
loadRuntimeConfig(environment)
  .then(env => bootstrapApplication(App, buildAppConfig(env)))
  .catch(err => console.error(err));
