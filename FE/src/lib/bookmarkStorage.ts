export const BOOKMARK_STORAGE_KEY = 'fishnote:bookmarkedFishIds';
export const BOOKMARK_MERGE_DISMISSED_KEY = 'fishnote:bookmarkMergeDismissed';

type BookmarkSnapshot = number[];

const listeners = new Set<() => void>();
const emptySnapshot: BookmarkSnapshot = [];
let cachedRawValue: string | null | undefined;
let cachedSnapshot: BookmarkSnapshot = emptySnapshot;

export function readLocalBookmarks(): BookmarkSnapshot {
  if (typeof window === 'undefined') return emptySnapshot;

  let rawValue: string | null;
  try {
    rawValue = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
  } catch {
    return emptySnapshot;
  }

  if (rawValue === cachedRawValue) return cachedSnapshot;
  cachedRawValue = rawValue;

  if (!rawValue) {
    cachedSnapshot = emptySnapshot;
    return cachedSnapshot;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      cachedSnapshot = emptySnapshot;
      return cachedSnapshot;
    }

    const ids = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    cachedSnapshot = Array.from(new Set(ids));
    return cachedSnapshot;
  } catch {
    cachedSnapshot = emptySnapshot;
    return cachedSnapshot;
  }
}

export function writeLocalBookmarks(ids: BookmarkSnapshot) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    return;
  }

  notifyLocalBookmarksChanged();
}

export function clearLocalBookmarks() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(BOOKMARK_STORAGE_KEY);
  } catch {
    return;
  }

  notifyLocalBookmarksChanged();
}

export function subscribeLocalBookmarks(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key === BOOKMARK_STORAGE_KEY) {
      listener();
    }
  }

  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function isBookmarkMergeDismissed() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(BOOKMARK_MERGE_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissBookmarkMerge() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(BOOKMARK_MERGE_DISMISSED_KEY, 'true');
  } catch {
    return;
  }
}

export function clearBookmarkMergeDismissed() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(BOOKMARK_MERGE_DISMISSED_KEY);
  } catch {
    return;
  }
}

function notifyLocalBookmarksChanged() {
  cachedRawValue = undefined;
  listeners.forEach((listener) => listener());
}
