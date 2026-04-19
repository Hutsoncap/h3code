import { describe, expect, it } from "vitest";

import {
  ABOUT_BLANK_URL,
  BROWSER_SEARCH_URL_TEMPLATES,
  browserAddressDisplayValue,
  buildBrowserSearchUrl,
  normalizeBrowserAddressInput,
  normalizeBrowserSearchTemplate,
  parseBrowserHomepageUrl,
  resolveBrowserNavigationTarget,
  resolveBrowserSearchUrlTemplate,
} from "./browserAddress";

describe("normalizeBrowserSearchTemplate", () => {
  it("accepts valid http templates that include the query placeholder", () => {
    expect(normalizeBrowserSearchTemplate("https://example.com/search?q={query}")).toBe(
      "https://example.com/search?q={query}",
    );
  });

  it("rejects templates without the query placeholder", () => {
    expect(normalizeBrowserSearchTemplate("https://example.com/search")).toBeNull();
  });
});

describe("resolveBrowserSearchUrlTemplate", () => {
  it("falls back to Google when the template is invalid", () => {
    expect(resolveBrowserSearchUrlTemplate("https://example.com/search")).toBe(
      BROWSER_SEARCH_URL_TEMPLATES.google,
    );
  });
});

describe("buildBrowserSearchUrl", () => {
  it("replaces every query placeholder", () => {
    expect(
      buildBrowserSearchUrl("hello world", "https://example.com/?q={query}&again={query}"),
    ).toBe("https://example.com/?q=hello%20world&again=hello%20world");
  });
});

describe("parseBrowserHomepageUrl", () => {
  it("treats blank homepage values as about:blank", () => {
    expect(parseBrowserHomepageUrl("")).toBe(ABOUT_BLANK_URL);
  });

  it("normalizes naked hostnames into https urls", () => {
    expect(parseBrowserHomepageUrl("example.com")).toBe("https://example.com/");
  });

  it("rejects values that are neither urls nor about:blank", () => {
    expect(parseBrowserHomepageUrl("search me please")).toBeNull();
  });
});

describe("resolveBrowserNavigationTarget", () => {
  it("uses the configured search template for free-form queries", () => {
    expect(
      resolveBrowserNavigationTarget("how to bake bread", {
        searchTemplate: BROWSER_SEARCH_URL_TEMPLATES.duckduckgo,
      }),
    ).toEqual({
      kind: "search",
      url: "https://duckduckgo.com/?q=how%20to%20bake%20bread",
    });
  });

  it("keeps valid urls as direct navigation targets", () => {
    expect(resolveBrowserNavigationTarget("https://example.com")).toEqual({
      kind: "url",
      url: "https://example.com/",
    });
  });
});

describe("normalizeBrowserAddressInput", () => {
  it("hides quote-wrapped blank placeholders behind about:blank", () => {
    expect(normalizeBrowserAddressInput(' "   " ')).toBe(ABOUT_BLANK_URL);
  });
});

describe("browserAddressDisplayValue", () => {
  it("hides about:blank from the address bar", () => {
    expect(browserAddressDisplayValue(ABOUT_BLANK_URL)).toBe("");
  });
});
