import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/** Per-page title + description + Open Graph tags (client-rendered; add SSR/prerender for crawlers — see README). */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title); private meta = inject(Meta);
  set(title: string, description?: string, image?: string) {
    const full = title ? `${title} · Lenscape` : 'Lenscape — Book trusted photographers near you';
    this.title.setTitle(full); this.meta.updateTag({ property: 'og:title', content: full });
    if (description) { this.meta.updateTag({ name: 'description', content: description }); this.meta.updateTag({ property: 'og:description', content: description }); }
    if (image && !image.startsWith('data:')) this.meta.updateTag({ property: 'og:image', content: image });
  }
}
