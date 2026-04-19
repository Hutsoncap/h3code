// FILE: BrowserPanel.logic.ts
// Purpose: Holds the address-bar sync rules and suggestions for the in-app browser panel.
// Layer: Component logic helper
// Exports: browserAddressDisplayValue, normalizeBrowserAddressInput, buildBrowserAddressSuggestions
// Depends on: browser tab metadata and thread-local browser history

import type { BrowserTabState } from "@t3tools/contracts";
import {
  browserAddressDisplayValue as formatBrowserAddressDisplayValue,
  normalizeBrowserAddressInput as normalizeBrowserAddressTarget,
  resolveBrowserNavigationTarget,
} from "@t3tools/shared/browserAddress";
import { trimOrNull } from "@t3tools/shared/model";
import type { BrowserHistoryEntry } from "../browserStateStore";

const BROWSER_SUGGESTION_LIMIT = 6;

interface ResolveBrowserAddressSyncInput {
  activeTabId: string | null;
  previousActiveTabId: string | null;
  savedDraft: string | undefined;
  nextDisplayValue: string;
  lastSyncedValue: string | undefined;
  isEditing: boolean;
}

type BrowserAddressSyncDecision =
  | {
      type: "keep";
    }
  | {
      type: "replace";
      value: string;
      syncedValue: string | undefined;
    };

export interface BrowserAddressSuggestion {
  id: string;
  kind: "navigate" | "tab" | "history";
  title: string;
  detail: string;
  url: string;
  tabId?: string;
  faviconUrl?: string | null;
}

interface BuildBrowserAddressSuggestionsInput {
  query: string;
  searchTemplate?: string;
  activeTabId: string | null;
  tabs: Array<Pick<BrowserTabState, "id" | "title" | "url" | "faviconUrl" | "lastCommittedUrl">>;
  recentHistory: BrowserHistoryEntry[];
}

export interface BrowserChromeStatus {
  tone: "default" | "error";
  label: string;
}

// Hides about:blank from the address bar so new tabs behave like real browsers.
export function browserAddressDisplayValue(
  tab: Pick<BrowserTabState, "url"> | null | undefined,
): string {
  return formatBrowserAddressDisplayValue(tab?.url);
}

// Normalizes typed text into the url or search target we should submit.
export function normalizeBrowserAddressInput(
  input: string,
  options?: { searchTemplate?: string },
): string {
  return normalizeBrowserAddressTarget(input, options);
}

function normalizeQuery(value: string): string {
  return trimOrNull(value)?.toLowerCase() ?? "";
}

function displaySuggestionUrl(value: string): string {
  const normalized = trimOrNull(value) ?? "";
  return normalized.replace(/^about:blank$/i, "");
}

function suggestionMatches(query: string, candidate: string): boolean {
  if (query.length === 0) {
    return true;
  }
  return normalizeQuery(candidate).includes(query);
}

function pushSuggestion(
  suggestions: BrowserAddressSuggestion[],
  seenUrls: Set<string>,
  suggestion: BrowserAddressSuggestion,
): void {
  if (suggestions.length >= BROWSER_SUGGESTION_LIMIT || seenUrls.has(suggestion.url)) {
    return;
  }

  seenUrls.add(suggestion.url);
  suggestions.push(suggestion);
}

// Builds browser-like suggestions from the typed query, open tabs, and recent history.
export function buildBrowserAddressSuggestions(
  input: BuildBrowserAddressSuggestionsInput,
): BrowserAddressSuggestion[] {
  const query = normalizeQuery(input.query);
  const suggestions: BrowserAddressSuggestion[] = [];
  const seenUrls = new Set<string>();
  const directTarget = resolveBrowserNavigationTarget(input.query, {
    searchTemplate: input.searchTemplate,
  });

  if (query.length > 0) {
    const directTitle =
      directTarget.kind === "search"
        ? `Search the web for "${input.query.trim()}"`
        : `Open ${directTarget.url}`;
    pushSuggestion(suggestions, seenUrls, {
      id: `direct:${directTarget.url}`,
      kind: "navigate",
      title: directTitle,
      detail: directTarget.url,
      url: directTarget.url,
    });
  }

  for (const tab of input.tabs) {
    const tabUrl = displaySuggestionUrl(tab.lastCommittedUrl ?? tab.url);
    if (tabUrl.length === 0 || tab.id === input.activeTabId) {
      continue;
    }
    if (!suggestionMatches(query, `${tab.title} ${tabUrl}`)) {
      continue;
    }
    pushSuggestion(suggestions, seenUrls, {
      id: `tab:${tab.id}`,
      kind: "tab",
      title: tab.title || tabUrl,
      detail: tabUrl,
      url: tabUrl,
      tabId: tab.id,
      faviconUrl: tab.faviconUrl,
    });
  }

  for (const entry of input.recentHistory) {
    const entryUrl = displaySuggestionUrl(entry.url);
    if (entryUrl.length === 0) {
      continue;
    }
    if (!suggestionMatches(query, `${entry.title} ${entryUrl}`)) {
      continue;
    }
    pushSuggestion(suggestions, seenUrls, {
      id: `history:${entry.url}`,
      kind: "history",
      title: entry.title || entryUrl,
      detail: entryUrl,
      url: entryUrl,
    });
  }

  return suggestions.slice(0, BROWSER_SUGGESTION_LIMIT);
}

// Only shows transient browser state; the address field already reflects the active URL.
export function resolveBrowserChromeStatus(input: {
  localError: string | null;
  threadLastError: string | null | undefined;
  activeTabStatus: string;
  hasActiveTab: boolean;
  workspaceReady: boolean;
}): BrowserChromeStatus | null {
  if (input.localError) {
    return {
      tone: "error",
      label: input.localError,
    };
  }

  if (input.threadLastError) {
    return {
      tone: "error",
      label: input.threadLastError,
    };
  }

  if (!input.hasActiveTab) {
    return {
      tone: "default",
      label: input.workspaceReady ? "No tabs open" : "Starting browser...",
    };
  }

  if (input.activeTabStatus === "suspended") {
    return {
      tone: "default",
      label: "Restoring tab...",
    };
  }

  return null;
}

// Decides when browser state should replace the visible address input.
export function resolveBrowserAddressSync(
  input: ResolveBrowserAddressSyncInput,
): BrowserAddressSyncDecision {
  if (!input.activeTabId) {
    return {
      type: "replace",
      value: "",
      syncedValue: undefined,
    };
  }

  if (input.activeTabId !== input.previousActiveTabId) {
    if (input.savedDraft !== undefined) {
      return {
        type: "replace",
        value: input.savedDraft,
        syncedValue: input.lastSyncedValue,
      };
    }

    return {
      type: "replace",
      value: input.nextDisplayValue,
      syncedValue: input.nextDisplayValue,
    };
  }

  if (input.isEditing || input.lastSyncedValue === input.nextDisplayValue) {
    return { type: "keep" };
  }

  return {
    type: "replace",
    value: input.nextDisplayValue,
    syncedValue: input.nextDisplayValue,
  };
}
