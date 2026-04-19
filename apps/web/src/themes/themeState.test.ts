import { describe, expect, it } from "vitest";
import { DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID } from "./catalog";
import {
  DEFAULT_THEME_PREFERENCE,
  normalizeStoredThemePreference,
  resolveActiveTheme,
} from "./themeState";

describe("themeState", () => {
  describe("normalizeStoredThemePreference", () => {
    it("migrates legacy light/dark/system strings into structured preferences", () => {
      expect(normalizeStoredThemePreference("system")).toEqual(DEFAULT_THEME_PREFERENCE);
      expect(normalizeStoredThemePreference("light")).toEqual({
        ...DEFAULT_THEME_PREFERENCE,
        mode: "manual",
        themeId: DEFAULT_LIGHT_THEME_ID,
      });
      expect(normalizeStoredThemePreference("dark")).toEqual({
        ...DEFAULT_THEME_PREFERENCE,
        mode: "manual",
        themeId: DEFAULT_DARK_THEME_ID,
      });
    });

    it("normalizes invalid variant-specific ids back to safe defaults", () => {
      expect(
        normalizeStoredThemePreference(
          JSON.stringify({
            mode: "system",
            themeId: "missing-theme",
            lightThemeId: "tokyo-night",
            darkThemeId: "gruvbox-light",
          }),
        ),
      ).toEqual({
        mode: "system",
        themeId: DEFAULT_DARK_THEME_ID,
        lightThemeId: DEFAULT_LIGHT_THEME_ID,
        darkThemeId: DEFAULT_DARK_THEME_ID,
      });
    });
  });

  describe("resolveActiveTheme", () => {
    it("uses the manual theme directly when manual mode is selected", () => {
      const preference = {
        ...DEFAULT_THEME_PREFERENCE,
        mode: "manual" as const,
        themeId: "gruvbox-light",
      };

      expect(resolveActiveTheme(preference, false).id).toBe("gruvbox-light");
      expect(resolveActiveTheme(preference, true).id).toBe("gruvbox-light");
    });

    it("switches between the configured system light and dark themes", () => {
      const preference = {
        ...DEFAULT_THEME_PREFERENCE,
        mode: "system" as const,
        lightThemeId: "catppuccin-latte",
        darkThemeId: "tokyo-night",
      };

      expect(resolveActiveTheme(preference, false).id).toBe("catppuccin-latte");
      expect(resolveActiveTheme(preference, true).id).toBe("tokyo-night");
    });
  });
});
