type StorageArea = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(
  kind: 'localStorage' | 'sessionStorage',
): StorageArea | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window[kind];
    if (!storage) {
      return null;
    }

    return storage;
  } catch {
    return null;
  }
}

export function readLocalStorageItem(key: string): string | null {
  const storage = getStorage('localStorage');
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorageItem(key: string, value: string): boolean {
  const storage = getStorage('localStorage');
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeLocalStorageItem(key: string): boolean {
  const storage = getStorage('localStorage');
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readSessionStorageItem(key: string): string | null {
  const storage = getStorage('sessionStorage');
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionStorageItem(key: string, value: string): boolean {
  const storage = getStorage('sessionStorage');
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeSessionStorageItem(key: string): boolean {
  const storage = getStorage('sessionStorage');
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function replaceBrowserHistoryState(url: string): boolean {
  if (typeof window === 'undefined' || typeof window.history?.replaceState !== 'function') {
    return false;
  }

  try {
    window.history.replaceState({}, document.title, url);
    return true;
  } catch {
    return false;
  }
}

export function isBrowserStateError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'InvalidStateError' ||
    error.name === 'SecurityError' ||
    /state cached in an interface object/i.test(error.message)
  );
}

export function toFriendlyBrowserStateMessage(
  error: unknown,
  fallback = 'The browser could not access saved page state. Refresh and try again.',
): string {
  if (isBrowserStateError(error)) {
    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
}
