import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { CatalogRepository } from '../../core/api/repositories';
import { FavoritesStore } from '../../core/state/stores';
import { PhotographerCardComponent } from '../../shared/cards/photographer-card.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'app-favorites',
  imports: [PhotographerCardComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-page-header title="Favourites" subtitle="Photographers you've saved." />
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (res.isLoading() && !res.value()) { <div class="grid grid--4">@for (s of [1,2,3]; track s) { <div class="skeleton" style="height: 340px"></div> }</div> }
  @else if (!(res.value() ?? []).length) { <div class="card"><app-empty-state icon="heart" title="No favourites yet" text="Save photographers while browsing to compare them later." actionLabel="Browse photographers" actionLink="/discover" /></div> }
  @else { <div class="grid grid--4">@for (p of res.value(); track p.id) { <app-photographer-card [p]="p" /> }</div> }`,
})
export class FavoritesPage {
  private fav = inject(FavoritesStore); private catalog = inject(CatalogRepository);
  readonly res = rxResource({ params: () => this.fav.ids().join(','), stream: () => (this.fav.ids().length ? this.catalog.summaries(this.fav.ids()) : of([])) });
  constructor() { inject(SeoService).set('Favourites'); }
}
