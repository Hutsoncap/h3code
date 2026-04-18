import { describe, expect, it } from "vitest";

import { isNonFatalCodexErrorMessage } from "./codexErrorClassification";

describe("isNonFatalCodexErrorMessage", () => {
  it("matches the known closed-stdin warning regardless of casing or whitespace", () => {
    expect(
      isNonFatalCodexErrorMessage("  WRITE_STDIN failed: stdin is closed for this session  "),
    ).toBe(true);
  });

  it("rejects different runtime failures", () => {
    expect(isNonFatalCodexErrorMessage("write_stdin failed: connection reset by peer")).toBe(false);
    expect(isNonFatalCodexErrorMessage("session crashed unexpectedly")).toBe(false);
  });
});
