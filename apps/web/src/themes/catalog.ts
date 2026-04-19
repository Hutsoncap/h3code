import type { ITheme } from "@xterm/xterm";
import type { AppTheme, ThemeTokens, ThemeVariant } from "./types";

const DEFAULT_LIGHT_TOKENS: ThemeTokens = {
  background: "#ffffff",
  foreground: "#262626",
  card: "#ffffff",
  cardForeground: "#262626",
  popover: "#ffffff",
  popoverForeground: "#262626",
  primary: "#171717",
  primaryForeground: "#ffffff",
  secondary: "#0000000a",
  secondaryForeground: "#262626",
  muted: "#0000000a",
  mutedForeground: "#737373",
  accent: "#0000000a",
  accentForeground: "#262626",
  destructive: "#ef4444",
  border: "#0000000d",
  input: "#0000000f",
  ring: "#a3a3a3",
  destructiveForeground: "#b91c1c",
  info: "#3b82f6",
  infoForeground: "#526fff",
  success: "#10b981",
  successForeground: "#047857",
  warning: "#f59e0b",
  warningForeground: "#b45309",
  claude: "#d97757",
};

const DEFAULT_DARK_TOKENS: ThemeTokens = {
  background: "#0a0a0a",
  foreground: "#f5f5f5",
  card: "#111111",
  cardForeground: "#f5f5f5",
  popover: "#111111",
  popoverForeground: "#f5f5f5",
  primary: "#f5f5f5",
  primaryForeground: "#171717",
  secondary: "#ffffff0a",
  secondaryForeground: "#f5f5f5",
  muted: "#ffffff0a",
  mutedForeground: "#a3a3a3",
  accent: "#ffffff0a",
  accentForeground: "#f5f5f5",
  destructive: "#f87171",
  border: "#ffffff0a",
  input: "#ffffff0d",
  ring: "#737373",
  destructiveForeground: "#fca5a5",
  info: "#3b82f6",
  infoForeground: "#6073cc",
  success: "#10b981",
  successForeground: "#34d399",
  warning: "#f59e0b",
  warningForeground: "#fbbf24",
  claude: "#d97757",
};

function hexToRgba(hex: string, alpha: number): string {
  const trimmed = hex.trim();
  if (!trimmed.startsWith("#")) {
    return trimmed;
  }

  let normalized = trimmed.slice(1);
  if (normalized.length === 3 || normalized.length === 4) {
    normalized = normalized
      .slice(0, 3)
      .split("")
      .map((segment) => `${segment}${segment}`)
      .join("");
  }
  if (normalized.length >= 8) {
    normalized = normalized.slice(0, 6);
  }
  if (normalized.length !== 6) {
    return trimmed;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildTerminalTheme(tokens: ThemeTokens, variant: ThemeVariant): ITheme {
  const scrollbarBase = variant === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)";
  const scrollbarHover = variant === "dark" ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.2)";
  const scrollbarActive = variant === "dark" ? "rgba(255, 255, 255, 0.24)" : "rgba(0, 0, 0, 0.28)";
  const selectionBackground = hexToRgba(tokens.primary, variant === "dark" ? 0.28 : 0.2);

  return {
    background: tokens.background,
    foreground: tokens.foreground,
    cursor: tokens.primary,
    cursorAccent: tokens.background,
    selectionBackground,
    selectionInactiveBackground: selectionBackground,
    scrollbarSliderBackground: scrollbarBase,
    scrollbarSliderHoverBackground: scrollbarHover,
    scrollbarSliderActiveBackground: scrollbarActive,
    black: tokens.muted,
    red: tokens.destructive,
    green: tokens.success,
    yellow: tokens.warning,
    blue: tokens.info,
    magenta: tokens.primary,
    cyan: tokens.accent,
    white: tokens.card,
    brightBlack: tokens.border,
    brightRed: tokens.destructiveForeground,
    brightGreen: tokens.successForeground,
    brightYellow: tokens.warningForeground,
    brightBlue: tokens.infoForeground,
    brightMagenta: tokens.primaryForeground,
    brightCyan: tokens.accentForeground,
    brightWhite: tokens.popoverForeground,
  };
}

function defineTheme(
  id: string,
  name: string,
  variant: ThemeVariant,
  tokenOverrides: Partial<ThemeTokens>,
): AppTheme {
  const baseTokens = variant === "dark" ? DEFAULT_DARK_TOKENS : DEFAULT_LIGHT_TOKENS;
  const tokens = { ...baseTokens, ...tokenOverrides };
  return {
    id,
    name,
    variant,
    tokens,
    terminal: buildTerminalTheme(tokens, variant),
  };
}

export const DEFAULT_LIGHT_THEME_ID = "default-light";
export const DEFAULT_DARK_THEME_ID = "default-dark";

export const THEME_CATALOG: readonly AppTheme[] = [
  defineTheme(DEFAULT_LIGHT_THEME_ID, "Default Light", "light", {}),
  defineTheme(DEFAULT_DARK_THEME_ID, "Default Dark", "dark", {}),
  defineTheme("gruvbox-light", "Gruvbox Light", "light", {
    background: "#fbf1c7",
    foreground: "#3c3836",
    card: "#f2e5bc",
    cardForeground: "#3c3836",
    popover: "#f9f5d7",
    popoverForeground: "#3c3836",
    primary: "#458588",
    primaryForeground: "#fbf1c7",
    secondary: "#d5c4a11f",
    secondaryForeground: "#504945",
    muted: "#d5c4a133",
    mutedForeground: "#7c6f64",
    accent: "#d7992124",
    accentForeground: "#3c3836",
    destructive: "#cc241d",
    border: "#bdae931f",
    input: "#bdae9329",
    ring: "#b57614",
    destructiveForeground: "#9d0006",
    info: "#458588",
    infoForeground: "#076678",
    success: "#98971a",
    successForeground: "#79740e",
    warning: "#d79921",
    warningForeground: "#b57614",
    claude: "#d65d0e",
  }),
  defineTheme("gruvbox-dark", "Gruvbox Dark", "dark", {
    background: "#1d2021",
    foreground: "#ebdbb2",
    card: "#282828",
    cardForeground: "#ebdbb2",
    popover: "#282828",
    popoverForeground: "#ebdbb2",
    primary: "#83a598",
    primaryForeground: "#1d2021",
    secondary: "#3c38361f",
    secondaryForeground: "#ebdbb2",
    muted: "#50494540",
    mutedForeground: "#a89984",
    accent: "#d7992122",
    accentForeground: "#fabd2f",
    destructive: "#fb4934",
    border: "#665c541f",
    input: "#665c5429",
    ring: "#b16286",
    destructiveForeground: "#fe8019",
    info: "#83a598",
    infoForeground: "#8ec07c",
    success: "#b8bb26",
    successForeground: "#8ec07c",
    warning: "#fabd2f",
    warningForeground: "#fe8019",
    claude: "#d79921",
  }),
  defineTheme("dracula", "Dracula", "dark", {
    background: "#282a36",
    foreground: "#f8f8f2",
    card: "#303241",
    cardForeground: "#f8f8f2",
    popover: "#303241",
    popoverForeground: "#f8f8f2",
    primary: "#bd93f9",
    primaryForeground: "#1f2230",
    secondary: "#44475a",
    secondaryForeground: "#f8f8f2",
    muted: "#44475a",
    mutedForeground: "#bdc0d3",
    accent: "#ff79c6",
    accentForeground: "#1f2230",
    destructive: "#ff5555",
    border: "#6272a4",
    input: "#44475a",
    ring: "#8be9fd",
    destructiveForeground: "#ff6e6e",
    info: "#8be9fd",
    infoForeground: "#c2ffff",
    success: "#50fa7b",
    successForeground: "#7dff9b",
    warning: "#f1fa8c",
    warningForeground: "#ffffb3",
    claude: "#ffb86c",
  }),
  defineTheme("nord", "Nord", "dark", {
    background: "#2e3440",
    foreground: "#eceff4",
    card: "#3b4252",
    cardForeground: "#eceff4",
    popover: "#3b4252",
    popoverForeground: "#eceff4",
    primary: "#88c0d0",
    primaryForeground: "#2e3440",
    secondary: "#434c5e",
    secondaryForeground: "#eceff4",
    muted: "#434c5e",
    mutedForeground: "#d8dee9",
    accent: "#81a1c1",
    accentForeground: "#eceff4",
    destructive: "#bf616a",
    border: "#4c566a",
    input: "#434c5e",
    ring: "#5e81ac",
    destructiveForeground: "#d08770",
    info: "#81a1c1",
    infoForeground: "#8fbcbb",
    success: "#a3be8c",
    successForeground: "#b5d19a",
    warning: "#ebcb8b",
    warningForeground: "#d08770",
    claude: "#d08770",
  }),
  defineTheme("catppuccin-latte", "Catppuccin Latte", "light", {
    background: "#eff1f5",
    foreground: "#4c4f69",
    card: "#ffffff",
    cardForeground: "#4c4f69",
    popover: "#ffffff",
    popoverForeground: "#4c4f69",
    primary: "#8839ef",
    primaryForeground: "#eff1f5",
    secondary: "#ccd0da",
    secondaryForeground: "#4c4f69",
    muted: "#e6e9ef",
    mutedForeground: "#6c6f85",
    accent: "#1e66f5",
    accentForeground: "#eff1f5",
    destructive: "#d20f39",
    border: "#dce0e8",
    input: "#ccd0da",
    ring: "#7287fd",
    destructiveForeground: "#e64553",
    info: "#179299",
    infoForeground: "#1e66f5",
    success: "#40a02b",
    successForeground: "#179299",
    warning: "#df8e1d",
    warningForeground: "#fe640b",
    claude: "#fe640b",
  }),
  defineTheme("catppuccin-mocha", "Catppuccin Mocha", "dark", {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    card: "#181825",
    cardForeground: "#cdd6f4",
    popover: "#181825",
    popoverForeground: "#cdd6f4",
    primary: "#cba6f7",
    primaryForeground: "#11111b",
    secondary: "#313244",
    secondaryForeground: "#cdd6f4",
    muted: "#313244",
    mutedForeground: "#a6adc8",
    accent: "#89b4fa",
    accentForeground: "#11111b",
    destructive: "#f38ba8",
    border: "#45475a",
    input: "#313244",
    ring: "#74c7ec",
    destructiveForeground: "#fab387",
    info: "#89dceb",
    infoForeground: "#74c7ec",
    success: "#a6e3a1",
    successForeground: "#94e2d5",
    warning: "#f9e2af",
    warningForeground: "#fab387",
    claude: "#fab387",
  }),
  defineTheme("solarized-light", "Solarized Light", "light", {
    background: "#fdf6e3",
    foreground: "#657b83",
    card: "#fffaf0",
    cardForeground: "#586e75",
    popover: "#fffaf0",
    popoverForeground: "#586e75",
    primary: "#268bd2",
    primaryForeground: "#fdf6e3",
    secondary: "#eee8d5",
    secondaryForeground: "#586e75",
    muted: "#eee8d5",
    mutedForeground: "#93a1a1",
    accent: "#2aa198",
    accentForeground: "#fdf6e3",
    destructive: "#dc322f",
    border: "#e2d9c3",
    input: "#e7dfcb",
    ring: "#6c71c4",
    destructiveForeground: "#cb4b16",
    info: "#268bd2",
    infoForeground: "#2aa198",
    success: "#859900",
    successForeground: "#2aa198",
    warning: "#b58900",
    warningForeground: "#cb4b16",
    claude: "#cb4b16",
  }),
  defineTheme("solarized-dark", "Solarized Dark", "dark", {
    background: "#002b36",
    foreground: "#93a1a1",
    card: "#073642",
    cardForeground: "#93a1a1",
    popover: "#073642",
    popoverForeground: "#93a1a1",
    primary: "#268bd2",
    primaryForeground: "#002b36",
    secondary: "#0b3b47",
    secondaryForeground: "#93a1a1",
    muted: "#0b3b47",
    mutedForeground: "#839496",
    accent: "#2aa198",
    accentForeground: "#002b36",
    destructive: "#dc322f",
    border: "#0f4c5c",
    input: "#0f4c5c",
    ring: "#6c71c4",
    destructiveForeground: "#cb4b16",
    info: "#268bd2",
    infoForeground: "#2aa198",
    success: "#859900",
    successForeground: "#b58900",
    warning: "#b58900",
    warningForeground: "#cb4b16",
    claude: "#cb4b16",
  }),
  defineTheme("tokyo-night", "Tokyo Night", "dark", {
    background: "#1a1b26",
    foreground: "#c0caf5",
    card: "#1f2335",
    cardForeground: "#c0caf5",
    popover: "#1f2335",
    popoverForeground: "#c0caf5",
    primary: "#7aa2f7",
    primaryForeground: "#1a1b26",
    secondary: "#2a2e40",
    secondaryForeground: "#c0caf5",
    muted: "#2a2e40",
    mutedForeground: "#9aa5ce",
    accent: "#bb9af7",
    accentForeground: "#1a1b26",
    destructive: "#f7768e",
    border: "#414868",
    input: "#2a2e40",
    ring: "#7dcfff",
    destructiveForeground: "#ff9e64",
    info: "#7dcfff",
    infoForeground: "#2ac3de",
    success: "#9ece6a",
    successForeground: "#73daca",
    warning: "#e0af68",
    warningForeground: "#ff9e64",
    claude: "#ff9e64",
  }),
] as const;

export const LIGHT_THEMES = THEME_CATALOG.filter((theme) => theme.variant === "light");
export const DARK_THEMES = THEME_CATALOG.filter((theme) => theme.variant === "dark");

export function getThemeById(id: string | null | undefined, variant?: ThemeVariant): AppTheme {
  const match = THEME_CATALOG.find((theme) => theme.id === id);
  if (match && (!variant || match.variant === variant)) {
    return match;
  }

  if (variant === "light") {
    return LIGHT_THEMES[0]!;
  }
  if (variant === "dark") {
    return DARK_THEMES[0]!;
  }
  return THEME_CATALOG[0]!;
}
