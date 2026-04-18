import { describe, expect, it } from "vitest";

import { normalizeRateLimitLabel } from "./rateLimits";

describe("normalizeRateLimitLabel", () => {
  it("falls back to Current for whitespace-only custom labels", () => {
    expect(normalizeRateLimitLabel("   ")).toBe("Current");
  });

  it("trims unknown labels while preserving their custom text", () => {
    expect(normalizeRateLimitLabel("  Burst Window  ")).toBe("Burst Window");
  });
});
