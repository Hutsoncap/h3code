import type { ITheme } from "@xterm/xterm";

export type ThemeVariant = "light" | "dark";

export interface ThemeTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  destructiveForeground: string;
  info: string;
  infoForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  claude: string;
}

export interface AppTheme {
  id: string;
  name: string;
  variant: ThemeVariant;
  tokens: ThemeTokens;
  terminal: ITheme;
}
