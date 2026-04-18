import { describe, expect, it } from "vitest";

import { toBranchActionErrorMessage } from "./BranchToolbarBranchSelector.logic";

describe("toBranchActionErrorMessage", () => {
  it("preserves non-empty error messages", () => {
    expect(toBranchActionErrorMessage(new Error("Checkout failed."))).toBe("Checkout failed.");
  });

  it("falls back when error messages are quote-wrapped blanks", () => {
    expect(toBranchActionErrorMessage(new Error(' "   " '))).toBe("An error occurred.");
  });

  it("falls back when raw string errors are quote-wrapped blanks", () => {
    expect(toBranchActionErrorMessage(' "   " ')).toBe("An error occurred.");
  });
});
