/**
 * The launch splash itself lives in index.html so it paints before any JavaScript runs.
 * This hides it: it stays for at least MIN_VISIBLE_MS (so the logo is actually seen), then plays the zoom-out and removes itself.
 */
export const MIN_VISIBLE_MS = 900;
const FAILSAFE_MS = 8000;

export function hideSplash(): void {
  const el = typeof document === 'undefined' ? null : document.getElementById('splash');
  if (!el) return;
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now()); // performance.now() counts from navigation start
  setTimeout(() => {
    el.classList.add('out');
    const remove = () => el.remove();
    el.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 1200); // in case transitionend never fires (reduced motion, background tab)
  }, wait);
}

/** Never leave the user staring at the splash if the app fails to start. */
export function armSplashFailsafe(): void {
  setTimeout(hideSplash, FAILSAFE_MS);
}

/** Same markup as the splash in index.html, for in-app use (login, signup, going home). `.cover` fades it in quickly instead of replaying the intro. */
export function createSplashElement(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'splash';
  el.className = 'cover';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Loading Lenscape');
  el.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#b8401f"/><circle class="ring" cx="32" cy="32" r="15" fill="none" stroke="#fff" stroke-width="5"/><circle cx="32" cy="32" r="5" fill="#fff"/></svg>';
  return el;
}