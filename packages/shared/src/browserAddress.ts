import { trimOrNull } from "./model";

export const ABOUT_BLANK_URL = "about:blank";
export const DEFAULT_BROWSER_SEARCH_URL_TEMPLATE = "https://www.google.com/search?q={query}";
export const BROWSER_SEARCH_URL_TEMPLATES = {
  google: DEFAULT_BROWSER_SEARCH_URL_TEMPLATE,
  duckduckgo: "https://duckduckgo.com/?q={query}",
  bing: "https://www.bing.com/search?q={query}",
} as const;

export interface BrowserNavigationTarget {
  kind: "blank" | "url" | "search";
  url: string;
}

function looksLikeUrlInput(value: string): boolean {
  return (
    value.includes(".") ||
    value.startsWith("localhost") ||
    value.startsWith("127.0.0.1") ||
    value.startsWith("0.0.0.0") ||
    value.startsWith("[::1]")
  );
}

export function normalizeBrowserSearchTemplate(input: string | null | undefined): string | null {
  const normalized = trimOrNull(input);
  if (!normalized || !normalized.includes("{query}")) {
    return null;
  }

  try {
    const candidate = new URL(normalized.replaceAll("{query}", "test"));
    return candidate.protocol === "http:" || candidate.protocol === "https:" ? normalized : null;
  } catch {
    return null;
  }
}

export function resolveBrowserSearchUrlTemplate(
  input: string | null | undefined,
  fallback = DEFAULT_BROWSER_SEARCH_URL_TEMPLATE,
): string {
  return normalizeBrowserSearchTemplate(input) ?? fallback;
}

export function buildBrowserSearchUrl(
  query: string,
  searchTemplate: string | null | undefined = DEFAULT_BROWSER_SEARCH_URL_TEMPLATE,
): string {
  const resolvedTemplate = resolveBrowserSearchUrlTemplate(searchTemplate);
  return resolvedTemplate.replaceAll("{query}", encodeURIComponent(query));
}

export function parseBrowserHomepageUrl(input: string | null | undefined): string | null {
  const trimmed = trimOrNull(input);
  if (trimmed === null || trimmed.toLowerCase() === ABOUT_BLANK_URL) {
    return ABOUT_BLANK_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "about:"
    ) {
      return parsed.toString();
    }
  } catch {
    // Fall through to host heuristics below.
  }

  if (looksLikeUrlInput(trimmed)) {
    const prefersHttp =
      trimmed.startsWith("localhost") ||
      trimmed.startsWith("127.0.0.1") ||
      trimmed.startsWith("0.0.0.0") ||
      trimmed.startsWith("[::1]");
    const scheme = prefersHttp ? "http" : "https";
    try {
      return new URL(`${scheme}://${trimmed}`).toString();
    } catch {
      return null;
    }
  }

  return null;
}

export function resolveBrowserHomepageUrl(input: string | null | undefined): string {
  return parseBrowserHomepageUrl(input) ?? ABOUT_BLANK_URL;
}

export function resolveBrowserNavigationTarget(
  input: string | undefined,
  options?: { searchTemplate?: string | null | undefined },
): BrowserNavigationTarget {
  const trimmed = trimOrNull(input);
  if (trimmed === null) {
    return {
      kind: "blank",
      url: ABOUT_BLANK_URL,
    };
  }

  try {
    const withScheme = new URL(trimmed);
    if (withScheme.protocol === "http:" || withScheme.protocol === "https:") {
      return {
        kind: "url",
        url: withScheme.toString(),
      };
    }
    if (withScheme.protocol === "about:") {
      return {
        kind: trimmed.toLowerCase() === ABOUT_BLANK_URL ? "blank" : "url",
        url: withScheme.toString(),
      };
    }
  } catch {
    // Fall through to browser-style heuristics below.
  }

  if (trimmed.includes(" ")) {
    return {
      kind: "search",
      url: buildBrowserSearchUrl(trimmed, options?.searchTemplate),
    };
  }

  if (looksLikeUrlInput(trimmed)) {
    const prefersHttp =
      trimmed.startsWith("localhost") ||
      trimmed.startsWith("127.0.0.1") ||
      trimmed.startsWith("0.0.0.0") ||
      trimmed.startsWith("[::1]");
    const scheme = prefersHttp ? "http" : "https";
    try {
      return {
        kind: "url",
        url: new URL(`${scheme}://${trimmed}`).toString(),
      };
    } catch {
      return {
        kind: "search",
        url: buildBrowserSearchUrl(trimmed, options?.searchTemplate),
      };
    }
  }

  return {
    kind: "search",
    url: buildBrowserSearchUrl(trimmed, options?.searchTemplate),
  };
}

export function normalizeBrowserAddressInput(
  input: string,
  options?: { searchTemplate?: string | null | undefined },
): string {
  return resolveBrowserNavigationTarget(input, options).url;
}

export function browserAddressDisplayValue(url: string | null | undefined): string {
  const normalized = trimOrNull(url) ?? "";
  return normalized.toLowerCase() === ABOUT_BLANK_URL ? "" : normalized;
}
