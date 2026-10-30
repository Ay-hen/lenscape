import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';
import { PriceInfo, ApiError } from '../../core/models';
import { priceLabel } from '../../core/util/price';
import { avatarImage } from '../../core/util/images';

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img [src]="shown()" [alt]="alt()" [style.width.px]="size()" [style.height.px]="size()" loading="lazy" (error)="broken.set(true)" />`,
  styles: `img { border-radius: 50%; object-fit: cover; background: var(--c-surface-3); display: block; }`,
})
export class AvatarComponent {
  readonly src = input<string>(''); readonly alt = input(''); readonly size = input(40); readonly name = input('');
  /** Empty address or an image that fails to load → the default picture. */
  readonly broken = signal(false);
  readonly shown = computed(() => (this.src() && !this.broken() ? this.src() : avatarImage(this.name() || this.alt())));
}

@Component({
  selector: 'app-rating',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (value() > 0) { <span class="r" [attr.aria-label]="'Rated ' + value() + ' out of 5' + (count() != null ? ' from ' + count() + ' reviews' : '')"><app-icon name="star" [size]="14" class="s" /><strong>{{ value().toFixed(1) }}</strong>@if (count() != null) { <span class="c">({{ count() }})</span> }</span> } @else { <span class="c">New</span> }`,
  styles: `.r { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; } .s { color: var(--c-accent); fill: var(--c-accent); } .c { color: var(--c-text-muted); font-size: 13px; }`,
})
export class RatingComponent { readonly value = input.required<number>(); readonly count = input<number | null>(null); }

@Component({
  selector: 'app-stars-input',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div role="radiogroup" aria-label="Rating" class="g">@for (n of [1,2,3,4,5]; track n) { <button type="button" role="radio" [attr.aria-checked]="value() === n" [attr.aria-label]="n + ' star' + (n > 1 ? 's' : '')" (click)="changed.emit(n)" [class.on]="n <= value()"><app-icon name="star" [size]="26" /></button> }</div>`,
  styles: `.g { display: flex; gap: 2px; } button { background: none; border: 0; padding: 2px; cursor: pointer; color: var(--c-border-strong); border-radius: 6px; } button.on { color: var(--c-accent); } button.on app-icon { fill: var(--c-accent); display: inline-flex; }`,
})
export class StarsInputComponent { readonly value = input(0); readonly changed = output<number>(); }

@Component({
  selector: 'app-price',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="p"><strong>{{ text() }}</strong></span>`,
  styles: `.p strong { font-variant-numeric: tabular-nums; }`,
})
export class PriceComponent { readonly info = input.required<PriceInfo>(); readonly text = computed(() => priceLabel(this.info())); }

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="e"><div class="i"><app-icon [name]="icon()" [size]="26" /></div><h3>{{ title() }}</h3>@if (text()) { <p>{{ text() }}</p> }
  @if (actionLabel()) { @if (actionLink()) { <a class="btn btn--primary" [routerLink]="actionLink()">{{ actionLabel() }}</a> } @else { <button class="btn btn--primary" type="button" (click)="action.emit()">{{ actionLabel() }}</button> } }<ng-content /></div>`,
  styles: `.e { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 48px 20px; color: var(--c-text-muted); } .i { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--c-surface-2); color: var(--c-text-muted); } h3 { color: var(--c-ink); font-size: 1.15rem; } p { max-width: 42ch; font-size: 14px; }`,
})
export class EmptyStateComponent { readonly icon = input('inbox'); readonly title = input.required<string>(); readonly text = input(''); readonly actionLabel = input(''); readonly actionLink = input<string | any[] | null>(null); readonly action = output<void>(); }

@Component({
  selector: 'app-error-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="notice notice--error" role="alert"><app-icon name="alert-triangle" /><div class="grow"><strong>{{ title() }}</strong><div>{{ message() }}</div></div>@if (retryable()) { <button class="btn btn--sm btn--outline" type="button" (click)="retry.emit()">Try again</button> }</div>`,
})
export class ErrorStateComponent {
  readonly error = input<unknown>(null); readonly title = input('Something went wrong'); readonly retryable = input(true); readonly retry = output<void>();
  readonly message = computed(() => { const e = this.error(); return e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Please try again.'; });
}

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="h"><div><h1>{{ title() }}</h1>@if (subtitle()) { <p class="muted">{{ subtitle() }}</p> }</div><div class="a"><ng-content /></div></header>`,
  styles: `.h { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; } h1 { font-size: clamp(1.5rem, 3vw, 2rem); } p { margin-top: 4px; } .a { display: flex; gap: 8px; flex-wrap: wrap; }`,
})
export class PageHeaderComponent { readonly title = input.required<string>(); readonly subtitle = input(''); }

@Component({
  selector: 'app-stat-card',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="s card"><div class="top"><span class="l">{{ label() }}</span>@if (icon()) { <span class="ic"><app-icon [name]="icon()" [size]="16" /></span> }</div><div class="v tnum">{{ value() }}</div>@if (hint()) { <div class="h" [class.up]="trend() === 'up'" [class.down]="trend() === 'down'">{{ hint() }}</div> }</div>`,
  styles: `.s { padding: 16px 18px; } .top { display: flex; justify-content: space-between; align-items: center; } .l { font-size: 13px; color: var(--c-text-muted); font-weight: 500; } .ic { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; background: var(--c-primary-50); color: var(--c-primary-text); }
  .v { font-family: var(--font-display); font-size: 1.9rem; font-weight: 600; margin-top: 6px; color: var(--c-ink); line-height: 1.1; } .h { font-size: 12px; color: var(--c-text-muted); margin-top: 6px; } .up { color: var(--c-success); } .down { color: var(--c-error); }`,
})
export class StatCardComponent { readonly label = input.required<string>(); readonly value = input.required<string | number>(); readonly hint = input(''); readonly icon = input(''); readonly trend = input<'up' | 'down' | null>(null); }

@Component({
  selector: 'app-pagination',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (pages() > 1) { <nav class="p" aria-label="Pagination"><button class="btn btn--sm btn--outline" type="button" [disabled]="page() <= 1" (click)="go(page() - 1)"><app-icon name="chevron-left" [size]="14" />Prev</button><span class="i small muted">Page {{ page() }} of {{ pages() }} · {{ total() }} results</span><button class="btn btn--sm btn--outline" type="button" [disabled]="page() >= pages()" (click)="go(page() + 1)">Next<app-icon name="chevron-right" [size]="14" /></button></nav> }`,
  styles: `.p { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 16px 0; flex-wrap: wrap; }`,
})
export class PaginationComponent {
  readonly page = input.required<number>(); readonly pageSize = input.required<number>(); readonly total = input.required<number>(); readonly pageChange = output<number>();
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  go(p: number) { this.pageChange.emit(p); }
}

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="skeleton" [style.height]="h()" [style.width]="w()" [style.borderRadius]="r()" aria-hidden="true"></div>`,
})
export class SkeletonComponent { readonly h = input('16px'); readonly w = input('100%'); readonly r = input('8px'); }
