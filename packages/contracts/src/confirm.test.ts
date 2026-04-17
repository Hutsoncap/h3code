import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { DesktopConfirmMessageSchema } from "./confirm";

const decodeConfirmMessage = Schema.decodeUnknownSync(DesktopConfirmMessageSchema);

describe("DesktopConfirmMessageSchema", () => {
  it("accepts non-empty trimmed confirm messages", () => {
    expect(decodeConfirmMessage("Delete project?\nThis cannot be undone.")).toBe(
      "Delete project?\nThis cannot be undone.",
    );
  });

  it("rejects empty or whitespace-only confirm messages", () => {
    expect(() => decodeConfirmMessage("   ")).toThrow();
    expect(() => decodeConfirmMessage("\n\t")).toThrow();
  });
});
