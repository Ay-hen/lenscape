import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SplashService } from './core/Splash.service';
import { ThemeService } from './core/theme.service';
import { OverlaysComponent } from './shared/ui/overlays.component';

@Component({ selector: 'app-root', imports: [RouterOutlet, OverlaysComponent], template: `<router-outlet /><app-overlays />` })
export class App { constructor() { inject(ThemeService); inject(SplashService); } }