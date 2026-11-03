import { ApplicationRef } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { buildAppConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './app/core/config/environment';
import { loadRuntimeConfig } from './app/core/config/runtime-config';
import { armSplashFailsafe, hideSplash } from './app/core/splash';

armSplashFailsafe();

// Build-time environment, optionally overridden by a public `config.json` at deploy time.
loadRuntimeConfig(environment)
  .then(env => bootstrapApplication(App, buildAppConfig(env)))
  .then(ref => {
    // Reveal the app once its first render has settled (but never wait longer than 2.5 s for slow requests).
    const settled = ref.injector.get(ApplicationRef).whenStable();
    return Promise.race([settled, new Promise(resolve => setTimeout(resolve, 2500))]);
  })
  .then(hideSplash)
  .catch(err => { console.error(err); hideSplash(); });