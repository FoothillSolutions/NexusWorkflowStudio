type StorageOperation = "read" | "write" | "remove";

interface StorageErrorContext {
  key: string;
  operation: StorageOperation;
}

type StorageErrorHandler = (
  error: unknown,
  context: StorageErrorContext,
) => void;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readStorageValue(
  key: string,
  onError?: StorageErrorHandler,
): string | null {
  if (!isBrowser()) return null;

  try {
    return localStorage.getItem(key);
  } catch (error) {
    onError?.(error, { key, operation: "read" });
    return null;
  }
}

export function writeStorageValue(
  key: string,
  value: string,
  onError?: StorageErrorHandler,
): boolean {
  if (!isBrowser()) return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    onError?.(error, { key, operation: "write" });
    return false;
  }
}

export function removeStorageValue(
  key: string,
  onError?: StorageErrorHandler,
): boolean {
  if (!isBrowser()) return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    onError?.(error, { key, operation: "remove" });
    return false;
  }
}

export function readJsonStorage<T>(
  key: string,
  fallback: T,
  onError?: StorageErrorHandler,
): T {
  const raw = readStorageValue(key, onError);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    onError?.(error, { key, operation: "read" });
    return fallback;
  }
}

export function writeJsonStorage<T>(
  key: string,
  value: T,
  onError?: StorageErrorHandler,
): boolean {
  return writeStorageValue(key, JSON.stringify(value), onError);
}

