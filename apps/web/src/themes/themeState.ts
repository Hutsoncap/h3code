import { DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID, getThemeById } from "./catalog";
import type { AppTheme, ThemeVariant } from "./types";
import { getPersistedStorageItem, setPersistedStorageItem } from "../lib/persistedStorage";

export type ThemeMode = "manual" | "system";

export interface ThemePreference {
  mode: ThemeMode;
  themeId: string;
  lightThemeId: string;
  darkThemeId: string;
}

export interface ThemeSnapshot extends ThemePreference {
  systemDark: boolean;
  activeTheme: AppTheme;
}

const STORAGE_KEY = "h3code:theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const THEME_TOKEN_VARIABLES: Record<keyof AppTheme["tokens"], `--${string}`> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  border: "--border",
  input: "--input",
  ring: "--ring",
  destructiveForeground: "--destructive-foreground",
  info: "--info",
  infoForeground: "--info-foreground",
  success: "--success",
  successForeground: "--success-foreground",
  warning: "--warning",
  warningForeground: "--warning-foreground",
  claude: "--claude",
};

export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  mode: "system",
  themeId: DEFAULT_DARK_THEME_ID,
  lightThemeId: DEFAULT_LIGHT_THEME_ID,
  darkThemeId: DEFAULT_DARK_THEME_ID,
};

export const DEFAULT_THEME_SNAPSHOT: ThemeSnapshot = {
  ...DEFAULT_THEME_PREFERENCE,
  systemDark: false,
  activeTheme: getThemeById(DEFAULT_LIGHT_THEME_ID, "light"),
};

let listeners: Array<() => void> = [];
let terminalPaletteListeners: Array<() => void> = [];
let lastSnapshot: ThemeSnapshot | null = null;
let lastDesktopTheme: ThemeVariant | null = null;

function hasThemeStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getSystemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MEDIA_QUERY).matches;
}

function areSnapshotsEqual(left: ThemeSnapshot | null, right: ThemeSnapshot): boolean {
  return (
    left !== null &&
    left.mode === right.mode &&
    left.themeId === right.themeId &&
    left.lightThemeId === right.lightThemeId &&
    left.darkThemeId === right.darkThemeId &&
    left.systemDark === right.systemDark &&
    left.activeTheme.id === right.activeTheme.id
  );
}

function normalizeThemeId(id: unknown, variant?: ThemeVariant): string {
  return getThemeById(typeof id === "string" ? id.trim() : null, variant).id;
}

function normalizeThemeIdWithFallback(
  id: unknown,
  fallbackId: string,
  variant?: ThemeVariant,
): string {
  const normalizedId = typeof id === "string" ? id.trim() : null;
  const match = getThemeById(normalizedId, variant);
  if (normalizedId && match.id === normalizedId) {
    return match.id;
  }
  return fallbackId;
}

export function normalizeStoredThemePreference(raw: string | null): ThemePreference {
  if (raw === "light") {
    return {
      ...DEFAULT_THEME_PREFERENCE,
      mode: "manual",
      themeId: DEFAULT_LIGHT_THEME_ID,
    };
  }
  if (raw === "dark") {
    return {
      ...DEFAULT_THEME_PREFERENCE,
      mode: "manual",
      themeId: DEFAULT_DARK_THEME_ID,
    };
  }
  if (raw === "system" || raw === null) {
    return DEFAULT_THEME_PREFERENCE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ThemePreference>;
    return {
      mode: parsed.mode === "manual" || parsed.mode === "system" ? parsed.mode : "system",
      themeId: normalizeThemeIdWithFallback(parsed.themeId, DEFAULT_THEME_PREFERENCE.themeId),
      lightThemeId: normalizeThemeIdWithFallback(
        parsed.lightThemeId,
        DEFAULT_THEME_PREFERENCE.lightThemeId,
        "light",
      ),
      darkThemeId: normalizeThemeIdWithFallback(
        parsed.darkThemeId,
        DEFAULT_THEME_PREFERENCE.darkThemeId,
        "dark",
      ),
    };
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function readStoredThemePreference(): ThemePreference {
  if (!hasThemeStorage()) {
    return DEFAULT_THEME_PREFERENCE;
  }

  try {
    return normalizeStoredThemePreference(getPersistedStorageItem(localStorage, STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function writeStoredThemePreference(preference: ThemePreference): void {
  if (!hasThemeStorage()) {
    return;
  }

  setPersistedStorageItem(localStorage, STORAGE_KEY, JSON.stringify(preference));
}

export function resolveActiveTheme(preference: ThemePreference, systemDark: boolean): AppTheme {
  if (preference.mode === "manual") {
    return getThemeById(preference.themeId);
  }

  return systemDark
    ? getThemeById(preference.darkThemeId, "dark")
    : getThemeById(preference.lightThemeId, "light");
}

function buildThemeSnapshot(preference: ThemePreference): ThemeSnapshot {
  const systemDark = getSystemDark();
  return {
    ...preference,
    systemDark,
    activeTheme: resolveActiveTheme(preference, systemDark),
  };
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function emitTerminalPaletteChange() {
  for (const listener of terminalPaletteListeners) {
    listener();
  }
}

function syncDesktopTheme(theme: ThemeVariant) {
  if (typeof window === "undefined") return;

  const bridge = window.desktopBridge;
  if (!bridge || lastDesktopTheme === theme) {
    return;
  }

  lastDesktopTheme = theme;
  void bridge.setTheme(theme).catch(() => {
    if (lastDesktopTheme === theme) {
      lastDesktopTheme = null;
    }
  });
}

function applyThemeSnapshot(snapshot: ThemeSnapshot, suppressTransitions = false) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const root = document.documentElement;
  if (
    !root ||
    typeof root.classList?.toggle !== "function" ||
    typeof root.style?.setProperty !== "function"
  ) {
    return;
  }
  if (suppressTransitions) {
    root.classList.add("no-transitions");
  }

  root.classList.toggle("dark", snapshot.activeTheme.variant === "dark");
  root.style.setProperty("color-scheme", snapshot.activeTheme.variant);
  if (typeof root.dataset === "object" && root.dataset !== null) {
    root.dataset.themeId = snapshot.activeTheme.id;
  }

  for (const [token, variableName] of Object.entries(THEME_TOKEN_VARIABLES) as Array<
    [keyof AppTheme["tokens"], `--${string}`]
  >) {
    root.style.setProperty(variableName, snapshot.activeTheme.tokens[token]);
  }

  syncDesktopTheme(snapshot.activeTheme.variant);

  if (suppressTransitions) {
    // Force the suppression class to apply before removal.
    // oxlint-disable-next-line no-unused-expressions
    root.offsetHeight;
    requestAnimationFrame(() => {
      root.classList.remove("no-transitions");
    });
  }
}

function publishSnapshot(nextSnapshot: ThemeSnapshot, suppressTransitions = false) {
  const snapshotChanged = !areSnapshotsEqual(lastSnapshot, nextSnapshot);
  lastSnapshot = nextSnapshot;

  applyThemeSnapshot(nextSnapshot, suppressTransitions);
  if (!snapshotChanged) {
    return nextSnapshot;
  }

  emitChange();
  emitTerminalPaletteChange();
  return nextSnapshot;
}

function updateThemePreference(
  updater: (current: ThemePreference) => ThemePreference,
  suppressTransitions = true,
): ThemeSnapshot {
  const nextPreference = updater(readStoredThemePreference());
  writeStoredThemePreference(nextPreference);
  return publishSnapshot(buildThemeSnapshot(nextPreference), suppressTransitions);
}

export function getThemeSnapshot(): ThemeSnapshot {
  if (lastSnapshot !== null) {
    return lastSnapshot;
  }

  lastSnapshot = buildThemeSnapshot(readStoredThemePreference());
  return lastSnapshot;
}

export function subscribeTheme(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  listeners.push(listener);

  const mediaQuery = window.matchMedia(MEDIA_QUERY);
  const handleMediaChange = () => {
    publishSnapshot(buildThemeSnapshot(readStoredThemePreference()), true);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== "t3code:theme") {
      return;
    }
    publishSnapshot(buildThemeSnapshot(readStoredThemePreference()), true);
  };

  mediaQuery.addEventListener("change", handleMediaChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners = listeners.filter((candidate) => candidate !== listener);
    mediaQuery.removeEventListener("change", handleMediaChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function setThemeMode(mode: ThemeMode): ThemeSnapshot {
  return updateThemePreference((current) => {
    if (mode === "manual") {
      const manualThemeId =
        current.mode === "manual"
          ? normalizeThemeId(current.themeId)
          : resolveActiveTheme(current, getSystemDark()).id;

      return {
        ...current,
        mode: "manual",
        themeId: manualThemeId,
      };
    }

    return {
      ...current,
      mode: "system",
    };
  });
}

export function setManualTheme(themeId: string): ThemeSnapshot {
  return updateThemePreference((current) => ({
    ...current,
    mode: "manual",
    themeId: normalizeThemeId(themeId),
  }));
}

export function setSystemThemeChoice(variant: ThemeVariant, themeId: string): ThemeSnapshot {
  return updateThemePreference((current) => {
    if (variant === "light") {
      return {
        ...current,
        lightThemeId: normalizeThemeId(themeId, "light"),
      };
    }

    return {
      ...current,
      darkThemeId: normalizeThemeId(themeId, "dark"),
    };
  });
}

export function resetThemePreference(): ThemeSnapshot {
  return updateThemePreference(() => DEFAULT_THEME_PREFERENCE);
}

export function getActiveTerminalPalette() {
  return getThemeSnapshot().activeTheme.terminal;
}

export function subscribeTerminalPalette(listener: () => void): () => void {
  terminalPaletteListeners.push(listener);
  return () => {
    terminalPaletteListeners = terminalPaletteListeners.filter(
      (candidate) => candidate !== listener,
    );
  };
}

if (typeof document !== "undefined") {
  publishSnapshot(buildThemeSnapshot(readStoredThemePreference()));
}
