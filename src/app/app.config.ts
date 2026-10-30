import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { provideDataLayer } from './core/providers';
import { AppEnv } from './core/config/app-config';
import { environment } from './core/config/environment';
import { authInterceptor, errorInterceptor } from './core/auth/interceptors';

export function buildAppConfig(env: AppEnv): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes, withComponentInputBinding(), withViewTransitions(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })),
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
      provideDataLayer(env),
    ],
  };
}

export const appConfig: ApplicationConfig = buildAppConfig(environment);
