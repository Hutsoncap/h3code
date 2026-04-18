import { describe, expect, it } from "vitest";

import { rootErrorDetails, rootErrorMessage } from "./-rootErrorPresentation";

describe("rootErrorMessage", () => {
  it("falls back when Error messages are quote-wrapped blanks", () => {
    expect(rootErrorMessage(new Error(' "   " '))).toBe("An unexpected router error occurred.");
  });

  it("falls back when string messages are quote-wrapped blanks", () => {
    expect(rootErrorMessage(' "   " ')).toBe("An unexpected router error occurred.");
  });
});

describe("rootErrorDetails", () => {
  it("preserves original string details for debugging", () => {
    expect(rootErrorDetails(' "   " ')).toBe(' "   " ');
  });
});
