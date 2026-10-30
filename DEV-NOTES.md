# Developer notes (conventions every feature follows)

Angular 22, standalone components, zoneless-friendly signals, `ChangeDetectionStrategy.OnPush`, strict TS + strict templates.

## Layers
- `core/models` typed domain contracts. `core/api/repositories.ts` abstract repositories (DI tokens). `core/http/*` HttpClient implementations that call the Spring Boot API (bound in `core/providers.ts`).ts`). `core/providers.ts` binds them.
- Pages NEVER call HttpClient and never embed sample data. They inject repositories (`inject(BookingRepository)`).
- Async data: `rxResource({ params: () => ..., stream: ({params}) => repo.method(params) })`. Template uses `res.isLoading()`, `res.error()`, `res.value()`, `res.reload()`.
  Pattern: `@if (res.error()) { <app-error-state [error]="res.error()" (retry)="res.reload()" /> } @else if (res.isLoading() && !res.value()) { skeletons } @else if (res.value(); as v) { ... }` and an `<app-empty-state>` when the list is empty.
- Mutations: call the repo, `.subscribe({ next, error })`, toast result via `ToastService` (`success/error/info`), error text via `errorText(e)` from `core/util/forms`.
- Sensitive actions: `await inject(ConfirmService).ask({ title, message, danger, reasonLabel, reasonRequired })` → `{ ok, reason }`.
- Forms: typed `FormBuilder.nonNullable`, `<app-field label control required hint>` wrapper around inputs (see `features/account/settings.page.ts`), `applyServerErrors(form, err)`.
- Current user: `inject(SessionStore)` (`user()`, `role()`), `AuthService`.
- Sample pages to imitate: `shared/pages/bookings.page.ts`, `shared/bookings/booking-detail.component.*`, `features/account/settings.page.ts`, `features/discover/discover.page.*`.

## Design system (src/styles + shared/ui)
Global classes: `.btn` (+ `--primary --outline --ghost --danger --danger-ghost --dark --sm --lg --block --icon`), `.input .select .textarea .check .field .field__label .field__hint .field__error`, `.form-grid`, `.card .card--pad .card__head .card__body`, `.table-wrap > table.table`, `.chip` (+ `aria-pressed`), `.notice notice--info|warn|error|success`, `.grid grid--2|3|4`, `.stack .row .grow .muted .small .xs .eyebrow .tnum .truncate`, `.skeleton`, `.divider`, `.link-btn`, `.fade-in`.
Tokens in `styles/_tokens.scss` (CSS vars `--c-*`, `--sp-*`, `--r-*`, `--shadow-*`, `--tier-<bronze|silver|gold|platinum>-{fg,bg,border,grad}`). Never hard-code colours.

### Theme (light/dark) and typography
- Font: Poppins only (`--font-body`; `--font-display` is an alias). Loaded once from `index.html`.
- Dark mode = `<html data-theme="dark">`, set before first paint by the inline script in `index.html`, then managed by `core/theme.service.ts`; toggle UI is `layouts/theme-toggle.component.ts`. The dark palette is ONE block of token overrides in `_tokens.scss` — components must not branch on theme.
- Token roles that matter in dark mode: `--c-ink` is TEXT only (it turns light in dark mode). Dark fills with white text use `--c-ink-bg`; always-dark chrome (footer, sidebar, banner) uses `--c-chrome*`. Primary-coloured text/links use `--c-primary-text`; solid blue fills use `--c-primary-600`. White-text status fills use `--c-success-solid` / `--c-error-solid`.
- The logo mark intentionally keeps its original brown (hard-coded in `layouts/logo.component.ts` and `public/favicon.svg`).
Components (selectors): `app-icon name size` (lucide subset in `shared/ui/icons.ts`; add names there if needed), `app-badge [status]|[tone]`, `app-tier-badge [tier]`, `app-avatar`, `app-rating [value][count]`, `app-stars-input`, `app-empty-state icon title text actionLabel actionLink (action)`, `app-error-state`, `app-page-header title subtitle` (projects action buttons), `app-stat-card label value hint icon trend`, `app-pagination page pageSize total (pageChange)`, `app-tabs tabs active (changed)`, `app-modal open label wide (closed)` (native dialog), `app-month-calendar month selected marks isDisabled (picked) (monthChange)`, `app-package-card pkg model selectable selected (chosen)`, `app-photographer-card`, `app-field`, charts in `shared/charts/charts.ts`: `app-line-chart [series] label prefix suffix`, `app-bar-chart [data]`, `app-hbar-list [data]`, `app-donut-chart [data]`; maps in `shared/map`: `app-location-picker [point][radiusKm] (pointChange)`, `app-location-search (picked)`, `app-map-view`.
Dates: always ISO strings; helpers in `core/util/dates.ts`. Money: `formatMoney`. Never invent data in components.

## Rules
- Tables must be responsive (`.table-wrap` scrolls) and any advertised search/filter/sort/pagination must work.
- Do not claim payment, identity verification or server confirmation that has not happened.
- Every interactive element is keyboard reachable with a visible focus state and an accessible name.

## Access control (frontend = UX layer only)
- `roleGuard` is async: `AuthService.verify()` re-reads the account via `AuthRepository.me()` and uses the BACKEND's role, never the role in localStorage (which anyone can edit). Forged, expired, unknown or suspended sessions are cleared and sent to `/login`; a genuine user of another role goes to their own home.
- Demo sessions (`demo: true`) are honoured only while `useMocks` is true; the login page hides the demo-account panel otherwise.
- The Spring Boot API must still authorise every request (`@PreAuthorize` / method security). Confirm that `GET /user/get-user/{username}` requires a valid token and returns `role`; if it omits `role`, `verify()` falls back to the role from the login response.

## Photographer location & equipment
- `PhotographerProfile.workMode`: `'freelancer'` (no shop) or `'shop'`. A freelancer only chooses a CITY; the map shows an approximate point inside it. A shop MUST send exact coordinates (`LocationInput.point`), which are published as-is, plus an optional `shopAddress`.
- `PhotographerWorkspaceRepository.setLocation(LocationInput)` is the ONLY way to change location. `updateProfile` ignores `workMode`, `publicLocation`, `shopAddress`, `city` and `serviceRadiusKm`. The real backend must enforce the same: ignore any client-sent point for freelancers and derive it from the city.
- Equipment is structured: `gear: { kind, name }[]` (camera, lens, video, drone, lighting, audio, accessory) plus `showGear`. The public profile shows it only when `showGear` is true. This replaces the old `equipment: string[]`, so the backend DTO must change accordingly. Limits: 30 items, 60 characters per name (`core/util/gear.ts`).
- The server enforces these rules (WorkspaceService.setLocation); the geo helpers are covered by the backend `PricingEngineTest`.
