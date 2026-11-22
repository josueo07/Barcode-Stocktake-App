const DEVICE_KEY = 'stocktake.deviceId';

function isLikelyMobile(): boolean {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

/**
 * A short id that stays the same for this browser, so the supervisor can tell two phones
 * apart (e.g. "iPhone 3F2A"). Falls back to a per-page id if storage is unavailable.
 */
let fallbackId: string | null = null;

export function getDeviceLabel(): string {
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(16).slice(2, 6).toUpperCase();
      window.localStorage.setItem(DEVICE_KEY, id);
    }
  } catch {
    fallbackId ??= Math.random().toString(16).slice(2, 6).toUpperCase();
    id = fallbackId;
  }
  const kind = /iPhone/i.test(navigator.userAgent)
    ? 'iPhone'
    : /iPad/i.test(navigator.userAgent)
      ? 'iPad'
      : isLikelyMobile()
        ? 'Teléfono'
        : 'PC';
  return `${kind} ${id}`;
}

/**
 * Asks the browser not to evict this site's storage (IndexedDB holds unsent scans).
 * Safari may decline; that's fine, it's best effort.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
}
