import { trimOrNull } from "@t3tools/shared/model";

export interface SyncStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const STORAGE_KEY_PREFIX_MIGRATIONS = [{ canonical: "h3code:", legacy: "t3code:" }] as const;

function normalizeLegacyStorageKey(key: string): string | null {
  return trimOrNull(key);
}

export function resolveLegacyStorageKeys(
  key: string,
  extraLegacyKeys: readonly string[] = [],
): string[] {
  const aliases = new Set<string>();
  for (const legacyKey of extraLegacyKeys) {
    const normalizedLegacyKey = normalizeLegacyStorageKey(legacyKey);
    if (!normalizedLegacyKey || normalizedLegacyKey === key) continue;
    aliases.add(normalizedLegacyKey);
  }

  for (const migration of STORAGE_KEY_PREFIX_MIGRATIONS) {
    if (!key.startsWith(migration.canonical)) {
      continue;
    }
    aliases.add(`${migration.legacy}${key.slice(migration.canonical.length)}`);
  }

  return [...aliases];
}

export function getPersistedStorageItem(
  storage: SyncStorageLike,
  key: string,
  extraLegacyKeys: readonly string[] = [],
): string | null {
  const currentValue = storage.getItem(key);
  if (currentValue !== null) {
    return currentValue;
  }

  for (const legacyKey of resolveLegacyStorageKeys(key, extraLegacyKeys)) {
    const legacyValue = storage.getItem(legacyKey);
    if (legacyValue === null) {
      continue;
    }

    storage.setItem(key, legacyValue);
    storage.removeItem(legacyKey);
    return legacyValue;
  }

  return null;
}

export function setPersistedStorageItem(
  storage: SyncStorageLike,
  key: string,
  value: string,
  extraLegacyKeys: readonly string[] = [],
): void {
  storage.setItem(key, value);
  for (const legacyKey of resolveLegacyStorageKeys(key, extraLegacyKeys)) {
    storage.removeItem(legacyKey);
  }
}

export function removePersistedStorageItem(
  storage: SyncStorageLike,
  key: string,
  extraLegacyKeys: readonly string[] = [],
): void {
  storage.removeItem(key);
  for (const legacyKey of resolveLegacyStorageKeys(key, extraLegacyKeys)) {
    storage.removeItem(legacyKey);
  }
}
