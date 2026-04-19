import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_THEME_PREFERENCE,
  DEFAULT_THEME_SNAPSHOT,
  type ThemeMode,
  getThemeSnapshot,
  resetThemePreference,
  setManualTheme,
  setSystemThemeChoice,
  setThemeMode,
  subscribeTheme,
} from "../themes/themeState";

export function useTheme() {
  const snapshot = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => DEFAULT_THEME_SNAPSHOT,
  );

  const setMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  const setTheme = useCallback((themeId: string) => {
    setManualTheme(themeId);
  }, []);

  const setSystemTheme = useCallback((variant: "light" | "dark", themeId: string) => {
    setSystemThemeChoice(variant, themeId);
  }, []);

  const resetTheme = useCallback(() => {
    resetThemePreference();
  }, []);

  return {
    ...snapshot,
    defaultThemePreference: DEFAULT_THEME_PREFERENCE,
    resolvedTheme: snapshot.activeTheme.variant,
    setMode,
    setTheme,
    setSystemTheme,
    resetTheme,
  } as const;
}
