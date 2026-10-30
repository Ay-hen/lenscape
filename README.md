# Lenscape — Angular frontend (integrated with the Spring Boot backend)

Customers discover, compare and book photographers; photographers run a studio (profile, services, packages, availability, automation, finance);
admins approve photographers, moderate content, resolve disputes and manage the platform.
Angular 22 · standalone components · signals · strict TypeScript.

**All data comes from the Spring Boot API.** There is no mock layer and no fallback data: if the API is unreachable the pages show an error state
with a retry button, and an empty database shows empty states.

## Requirements
Node.js ≥ 22.22.3 (24 LTS recommended) and npm 10+. The backend must be running (see the backend README), by default on `http://localhost:8080`.

## Run
```bash
npm ci
npm start            # http://localhost:4200  (API: src/app/core/config/environment.ts → apiBaseUrl)
npm test             # unit tests (Vitest through Angular's test builder)
npm run build        # production build → dist/photography-marketplace/browser
```

## Configuration
| What | Where |
|---|---|
| API base URL (dev) | `src/app/core/config/environment.ts` → `apiBaseUrl` (default `http://localhost:8080`) |
| API base URL (prod) | `src/app/core/config/environment.prod.ts`, **or** without rebuilding: copy `public/config.example.json` to `public/config.json` (served next to `index.html`) and set `apiBaseUrl` |
| Map tiles / geocoder | same two places (`map`, `geocoder`); defaults use OpenStreetMap/Nominatim, which have usage policies — use a provider with an agreement for production |

The backend must list the frontend origin in `CORS_ALLOWED_ORIGINS`. No secret belongs in this project: everything here ships to the browser.

## Architecture
```
src/app/core/api/repositories.ts   abstract repository contracts (DI tokens) — what the pages depend on
src/app/core/http/*                HttpClient implementations, one per contract; routes documented in docs/ENDPOINTS.md
src/app/core/providers.ts          binds contracts → HTTP implementations
src/app/core/auth/*                session store, JWT interceptor, error interceptor (401 → sign out), route guards
src/app/core/models/*              TypeScript contracts mirrored by the Java DTOs
```
* Pages never call `HttpClient`; they inject repositories and use `rxResource` with loading / error / empty states.
* `authInterceptor` adds `Authorization: Bearer <jwt>` to calls to the API only; `errorInterceptor` converts server errors
  (`{code, message, errors}`) into `ApiError`, which forms use to show field errors; a 401 on an authenticated call signs the user out.
* Route guards re-check the session against `GET /user/me` (role and status come from the database, not from localStorage). They are a UX layer:
  **the server authorises every request**.
* Sign-up is two steps: `/register` e-mails a 6-digit code, `/verify-email` confirms it; only then does the account exist and the user get signed in.
* The server is authoritative for prices, slot availability, booking transitions, refunds and permissions; the browser only displays them.
* Photographers without uploaded images get a generated placeholder (initials / gradient). It is display-only and never sent to the server.

## Known limitations
* The session (JWT) lives in `localStorage`. For a hardened deployment prefer an httpOnly, Secure, SameSite cookie issued by the API plus CSRF protection.
* Online payment is not implemented (no payment provider credentials exist): bookings stay "Unpaid" and the checkout says so.
* Messaging and notifications refresh through REST calls; the backend also offers a STOMP WebSocket (`/ws`) that this UI does not use yet.
* End-to-end browser tests are not included.
* Bundled `public/img/*` photos are stock imagery used for category tiles and the landing page; replace them with licensed images for a real launch.
