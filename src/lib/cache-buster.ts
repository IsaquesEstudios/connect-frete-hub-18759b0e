// Force-cleans stale service workers, caches and localStorage bits when the
// deployed app version changes. Prevents users from getting stuck on an old
// bundle (which was the source of "só funciona em aba anônima" reports).

const VERSION_KEY = "svlogistica:app-version";
// Bump this string on every deploy that needs to invalidate old clients.
export const APP_VERSION = __APP_VERSION__;

async function clearBrowserCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    }
  } catch {
    /* noop */
  }
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    /* noop */
  }
}

export async function runCacheBuster() {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(VERSION_KEY);
    if (stored !== APP_VERSION) {
      window.localStorage.setItem(VERSION_KEY, APP_VERSION);
      await clearBrowserCaches();
      if (stored) {
        // Only hard reload when we actually upgraded from a previous version.
        const url = new URL(window.location.href);
        url.searchParams.set("_v", APP_VERSION);
        window.location.replace(url.toString());
      }
    }
  } catch {
    /* noop */
  }
}

export async function forceClearCache() {
  await clearBrowserCaches();
  try {
    window.localStorage.removeItem(VERSION_KEY);
  } catch {
    /* noop */
  }
  window.location.reload();
}
