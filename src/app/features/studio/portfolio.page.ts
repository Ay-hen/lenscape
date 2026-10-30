import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CatalogRepository, PhotographerWorkspaceRepository, UploadRepository } from '../../core/api/repositories';
import { Album, PortfolioImage } from '../../core/models';
import { errorText } from '../../core/util/forms';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/ui/misc';
import { ConfirmService, ToastService } from '../../shared/services/overlay.services';

const MAX_MB = 8; const TYPES = /^image\/(jpeg|png|webp)$/;

@Component({
  selector: 'app-studio-portfolio',
  imports: [FormsModule, IconComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-page-header title="Portfolio" subtitle="Your best work, in the order you want it seen. Customers see only visible photos.">
    @if (dirty()) { <button class="btn btn--ghost" type="button" (click)="reset()">Discard</button><button class="btn btn--primary" type="button" [disabled]="busy()" (click)="save()">{{ busy() ? 'Saving…' : 'Save changes' }}</button> }
    <label class="btn btn--outline up"><app-icon name="upload" [size]="16" />{{ uploading() ? 'Uploading…' : 'Add photos' }}<input type="file" multiple accept="image/jpeg,image/png,image/webp" hidden (change)="add($event)" /></label>
  </app-page-header>
  @if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> }
  @else if (!res.value()) { <div class="skeleton" style="height: 300px"></div> }
  @else {
    <section class="card card--pad stack" aria-label="Albums"><div class="row"><strong>Albums</strong><span class="grow"></span>
      <input class="input" style="max-width: 220px" [(ngModel)]="newAlbum" (keydown.enter)="addAlbum()" placeholder="New album name" aria-label="New album name" maxlength="40" /><button type="button" class="btn btn--sm btn--outline" (click)="addAlbum()">Add album</button></div>
      <div class="chips">@for (a of albums(); track a.id) { <span class="chip alb"><input [ngModel]="a.name" (ngModelChange)="renameAlbum(a.id, $event)" [attr.aria-label]="'Album name ' + a.name" /><button type="button" (click)="removeAlbum(a)" [attr.aria-label]="'Delete album ' + a.name"><app-icon name="x" [size]="13" /></button></span> } @empty { <span class="muted small">No albums yet — photos are shown in one gallery.</span> }</div></section>
    @if (!images().length) { <app-empty-state icon="image" title="No photos yet" text="Upload at least 6 photos to complete your profile. Use images you own the rights to." /> }
    @else {
      <p class="muted small">{{ visibleCount() }} visible of {{ images().length }}. Images are uploaded to the server when you add them; save to publish your changes.</p>
      <ul class="grid grid--3 gal">@for (im of images(); track im.id; let i = $index) {
        <li class="card ph" [class.off]="!im.visible"><div class="pic"><img [src]="im.url" [alt]="im.caption || 'Portfolio photo'" loading="lazy" />@if (im.isCover) { <span class="cov">Cover</span> }</div>
          <div class="f"><input class="input" [ngModel]="im.caption" (ngModelChange)="patch(im.id, { caption: $event })" placeholder="Caption" [attr.aria-label]="'Caption for photo ' + (i + 1)" />
            <div class="row"><select class="select" [ngModel]="im.categoryId" (ngModelChange)="patch(im.id, { categoryId: $event })" [attr.aria-label]="'Category for photo ' + (i + 1)">@for (c of cats(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select>
              @if (albums().length) { <select class="select" [ngModel]="im.albumId ?? ''" (ngModelChange)="patch(im.id, { albumId: $event || undefined })" [attr.aria-label]="'Album for photo ' + (i + 1)"><option value="">No album</option>@for (a of albums(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }</select> }</div>
            <div class="row tools"><button type="button" class="btn btn--icon btn--ghost" [disabled]="i === 0" (click)="move(i, -1)" aria-label="Move earlier"><app-icon name="chevron-left" [size]="16" /></button><button type="button" class="btn btn--icon btn--ghost" [disabled]="i === images().length - 1" (click)="move(i, 1)" aria-label="Move later"><app-icon name="chevron-right" [size]="16" /></button>
              <button type="button" class="btn btn--sm btn--ghost" (click)="patch(im.id, { visible: !im.visible })">{{ im.visible ? 'Hide' : 'Show' }}</button><button type="button" class="btn btn--sm btn--ghost" [disabled]="im.isCover" (click)="setCover(im.id)">Set cover</button><span class="grow"></span><button type="button" class="btn btn--icon btn--ghost" (click)="remove(im)" aria-label="Delete photo"><app-icon name="trash" [size]="16" /></button></div></div></li> }</ul>
    }
    @if (error()) { <div class="notice notice--error" role="alert">{{ error() }}</div> }
  }`,
  styles: `.up { cursor: pointer; } .chips { display: flex; flex-wrap: wrap; gap: 8px; } .alb { display: inline-flex; align-items: center; gap: 4px; padding-right: 6px; } .alb input { border: 0; background: transparent; width: 110px; font: inherit; } .alb button { border: 0; background: none; cursor: pointer; display: grid; }
  .gal { margin-top: 16px; } .ph { overflow: hidden; } .ph.off { opacity: .6; } .pic { position: relative; aspect-ratio: 4/3; background: var(--c-surface-2); } .pic img { width: 100%; height: 100%; object-fit: cover; display: block; } .cov { position: absolute; top: 8px; left: 8px; background: var(--c-ink-bg); color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 99px; font-weight: 600; } .f { padding: 12px; display: flex; flex-direction: column; gap: 8px; } .tools { gap: 2px; flex-wrap: wrap; } .row .select { flex: 1; min-width: 0; }`,
})
export class StudioPortfolioPage {
  private ws = inject(PhotographerWorkspaceRepository); private upl = inject(UploadRepository); private catalog = inject(CatalogRepository); private toast = inject(ToastService); private confirm = inject(ConfirmService);
  readonly res = rxResource({ stream: () => this.ws.myProfile() }); private catRes = rxResource({ stream: () => this.catalog.categories() }); readonly cats = computed(() => this.catRes.value() ?? []);
  readonly images = signal<PortfolioImage[]>([]); readonly albums = signal<Album[]>([]); readonly dirty = signal(false); readonly busy = signal(false); readonly uploading = signal(false); readonly error = signal(''); newAlbum = '';
  readonly visibleCount = computed(() => this.images().filter(i => i.visible).length);
  constructor() {
    inject(SeoService).set('Portfolio');
    effect(() => { const p = this.res.value(); if (p) this.reset(p); });
  }
  reset(p = this.res.value()) { if (!p) return; this.images.set([...p.portfolio].sort((a, b) => a.order - b.order).map(x => ({ ...x }))); this.albums.set(p.albums.map(a => ({ ...a }))); this.dirty.set(false); }
  private touch<T>(sig: { update: (f: (v: T) => T) => void }, f: (v: T) => T) { sig.update(f); this.dirty.set(true); }
  patch(id: string, p: Partial<PortfolioImage>) { this.touch(this.images, l => l.map(x => (x.id === id ? { ...x, ...p } : x))); }
  setCover(id: string) { this.touch(this.images, l => l.map(x => ({ ...x, isCover: x.id === id }))); }
  move(i: number, d: number) { this.touch(this.images, l => { const a = [...l]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; }); }
  async remove(im: PortfolioImage) { const r = await this.confirm.ask({ title: 'Remove this photo?', message: 'It leaves your portfolio when you save.', confirmText: 'Remove', danger: true }); if (r.ok) this.touch(this.images, l => l.filter(x => x.id !== im.id)); }
  addAlbum() { const n = this.newAlbum.trim(); if (!n) return; this.touch(this.albums, l => [...l, { id: `alb-${Date.now()}`, name: n, order: l.length, visible: true }]); this.newAlbum = ''; }
  renameAlbum(id: string, name: string) { this.touch(this.albums, l => l.map(a => (a.id === id ? { ...a, name } : a))); }
  async removeAlbum(a: Album) { const r = await this.confirm.ask({ title: `Delete album “${a.name}”?`, message: 'Photos in it stay in your portfolio without an album.', confirmText: 'Delete album', danger: true }); if (!r.ok) return; this.touch(this.albums, l => l.filter(x => x.id !== a.id)); this.touch(this.images, l => l.map(x => (x.albumId === a.id ? { ...x, albumId: undefined } : x))); }
  add(ev: Event) {
    const input = ev.target as HTMLInputElement; const files = Array.from(input.files ?? []); input.value = ''; if (!files.length) return;
    const bad = files.filter(f => !TYPES.test(f.type) || f.size > MAX_MB * 1024 * 1024); if (bad.length) this.toast.error(`Skipped ${bad.length} file(s): use JPEG, PNG or WebP up to ${MAX_MB} MB.`);
    const ok = files.filter(f => !bad.includes(f)); if (!ok.length) return; this.uploading.set(true); let left = ok.length;
    for (const f of ok) this.upl.upload(f).subscribe({
      next: r => this.touch(this.images, l => [...l, { id: `img-${Date.now()}-${l.length}`, url: r.url, caption: f.name.replace(/\.[^.]+$/, ''), categoryId: this.res.value()?.specialties[0] ?? 'portrait', order: l.length, visible: true, isCover: l.length === 0 }]),
      error: e => { this.toast.error(errorText(e)); if (--left === 0) this.uploading.set(false); }, complete: () => { if (--left === 0) this.uploading.set(false); },
    });
  }
  save() {
    this.busy.set(true); this.error.set('');
    this.ws.savePortfolio(this.images().map((x, i) => ({ ...x, order: i })), this.albums().map((a, i) => ({ ...a, order: i }))).subscribe({ next: () => { this.busy.set(false); this.dirty.set(false); this.toast.success('Portfolio saved.'); this.res.reload(); }, error: e => { this.busy.set(false); this.error.set(errorText(e)); } });
  }
}
