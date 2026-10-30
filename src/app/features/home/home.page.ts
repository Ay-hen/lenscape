import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CatalogRepository } from '../../core/api/repositories';
import { todayISO } from '../../core/util/dates';
import { SeoService } from '../../core/seo.service';
import { PhotographerCardComponent } from '../../shared/cards/photographer-card.component';
import { PackageCardComponent } from '../../shared/cards/package-card.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ErrorStateComponent, SkeletonComponent } from '../../shared/ui/misc';
import { CITIES } from '../../core/geo/gazetteer';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ReactiveFormsModule, IconComponent, PhotographerCardComponent, PackageCardComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private repo = inject(CatalogRepository); private router = inject(Router); private fb = inject(FormBuilder);
  readonly cities = CITIES; readonly today = todayISO();
  readonly form = this.fb.nonNullable.group({ q: [''], category: [''], date: [''], maxPrice: [''] });
  readonly openFaq = signal<string | null>('f1');

  readonly data = rxResource({
    stream: () => forkJoin({
      categories: this.repo.categories(),
      featured: this.repo.search({ sort: 'recommended', page: 1, pageSize: 4 }),
      top: this.repo.search({ sort: 'rating', page: 1, pageSize: 4 }),
      value: this.repo.bestValuePackages(4),
      faqs: this.repo.faqs(),
      stories: this.repo.testimonials(3),
    }),
  });
  readonly categories = computed(() => this.data.value()?.categories ?? []);
  readonly skeletons = [1, 2, 3, 4];

  /** Real, recent, highly rated reviews. The section stays hidden until customers have actually left some. */
  readonly testimonials = computed(() => this.data.value()?.stories ?? []);

  constructor() { inject(SeoService).set('', 'Discover photographers on a map, compare packages and prices, and book weddings, portraits, events and more.'); }

  search() {
    const v = this.form.getRawValue(); const qp: Record<string, string> = {};
    if (v.q.trim()) qp['q'] = v.q.trim(); if (v.category) qp['category'] = v.category; if (v.date) qp['date'] = v.date; if (v.maxPrice) qp['max'] = v.maxPrice;
    void this.router.navigate(['/discover'], { queryParams: qp });
  }
}
