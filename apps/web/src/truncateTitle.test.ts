import { describe, expect, it } from "vitest";

import { truncateTitle } from "./truncateTitle";

describe("truncateTitle", () => {
  it("trims surrounding whitespace", () => {
    expect(truncateTitle("   hello world   ")).toBe("hello world");
  });

  it("treats quote-wrapped blank placeholders as empty titles", () => {
    expect(truncateTitle(' "   " ')).toBe("");
    expect(truncateTitle(" '   ' ")).toBe("");
  });

  it("returns trimmed text when within max length", () => {
    expect(truncateTitle("alpha", 10)).toBe("alpha");
  });

  it("appends ellipsis when text exceeds max length", () => {
    expect(truncateTitle("abcdefghij", 5)).toBe("ab...");
  });

  it("keeps the final output within tiny length budgets", () => {
    expect(truncateTitle("abcdefghij", 3)).toBe("...");
    expect(truncateTitle("abcdefghij", 2)).toBe("..");
    expect(truncateTitle("abcdefghij", 1)).toBe(".");
  });

  it("returns an empty string for zero or negative budgets", () => {
    expect(truncateTitle("abcdefghij", 0)).toBe("");
    expect(truncateTitle("abcdefghij", -1)).toBe("");
  });

  it("falls back to the default budget for non-finite values", () => {
    const title = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";

    expect(truncateTitle(title, Number.NaN)).toBe(truncateTitle(title));
    expect(truncateTitle(title, Number.POSITIVE_INFINITY)).toBe(truncateTitle(title));
  });
});
