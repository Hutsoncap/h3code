// FILE: terminalRuntimeAppearance.ts
// Purpose: Resolve terminal theme, font, and system-message styling from app chrome tokens.
// Layer: Terminal runtime infrastructure

import { Terminal, type ITheme } from "@xterm/xterm";
import { getActiveTerminalPalette } from "../../themes/themeState";

const FALLBACK_MONO_FONT_FAMILY =
  '"JetBrainsMono NFM", "JetBrainsMono NF", "JetBrains Mono", monospace';

export function getTerminalFontFamily(): string {
  if (typeof window === "undefined") {
    return FALLBACK_MONO_FONT_FAMILY;
  }

  const configuredFontFamily = getComputedStyle(document.documentElement)
    .getPropertyValue("--terminal-font-family")
    .trim();
  return configuredFontFamily || FALLBACK_MONO_FONT_FAMILY;
}

export function terminalThemeFromApp(): ITheme {
  return getActiveTerminalPalette();
}

export function writeSystemMessage(terminal: Terminal, message: string): void {
  terminal.write(`\r\n[terminal] ${message}\r\n`);
}
