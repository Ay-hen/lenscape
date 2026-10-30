import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({ selector: 'app-not-found', imports: [RouterLink], template: `<div class="nf"><p class="eyebrow">404</p><h1>This page wandered out of frame</h1><p class="muted">The page you're looking for doesn't exist or was moved.</p><div class="row"><a class="btn btn--primary" routerLink="/">Go home</a><a class="btn btn--outline" routerLink="/discover">Find photographers</a></div></div>`, styles: `.nf { min-height: 70vh; display: flex; flex-direction: column; gap: 14px; align-items: center; justify-content: center; text-align: center; padding: 24px; } h1 { max-width: 18ch; }` })
export class NotFoundPage {}
