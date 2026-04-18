// FILE: terminalCloseConfirmation.ts
// Purpose: Shares terminal-tab close confirmation copy and dialog plumbing across chat and workspace surfaces.
// Layer: UI logic helper
// Depends on: Native dialog contract from the app shell.

import type { NativeApi } from "@t3tools/contracts";
import { trimOrNull } from "@t3tools/shared/model";

function normalizeTerminalCloseTitle(value: string | null | undefined): string | null {
  const normalized = trimOrNull(value)?.replace(/\s+/g, " ");
  return normalized ?? null;
}

function formatTerminalCloseSubject(terminalTitle: string | null | undefined): string {
  const normalizedTitle = normalizeTerminalCloseTitle(terminalTitle);
  return normalizedTitle ? `terminal "${normalizedTitle}"` : "this terminal";
}

// Prefer title overrides, then persisted labels, so confirmation copy matches visible tab names.
export function resolveTerminalCloseTitle(options: {
  terminalId: string;
  terminalLabelsById: Record<string, string>;
  terminalTitleOverridesById: Record<string, string>;
}): string {
  return (
    normalizeTerminalCloseTitle(options.terminalTitleOverridesById[options.terminalId]) ||
    normalizeTerminalCloseTitle(options.terminalLabelsById[options.terminalId]) ||
    "Terminal"
  );
}

export function buildTerminalCloseConfirmationMessage(options: {
  terminalTitle: string | null | undefined;
  willDeleteThread: boolean;
}): string {
  return [
    `Close ${formatTerminalCloseSubject(options.terminalTitle)}?`,
    options.willDeleteThread
      ? "This permanently clears the terminal history for this tab and deletes the empty terminal thread."
      : "This permanently clears the terminal history for this tab.",
  ].join("\n");
}

export async function confirmTerminalTabClose(options: {
  api: Pick<NativeApi, "dialogs"> | null | undefined;
  enabled: boolean;
  terminalTitle: string | null | undefined;
  willDeleteThread?: boolean;
}): Promise<boolean> {
  if (!options.enabled || !options.api) {
    return true;
  }

  return options.api.dialogs.confirm(
    buildTerminalCloseConfirmationMessage({
      terminalTitle: options.terminalTitle,
      willDeleteThread: options.willDeleteThread ?? false,
    }),
  );
}
