import { describe, expect, it } from "vitest";

import { buildSidebarSearchHighlightSegments } from "./sidebarSearchHighlightSegments";

describe("buildSidebarSearchHighlightSegments", () => {
  it("returns the original text when the query is blank", () => {
    expect(buildSidebarSearchHighlightSegments("OpenAI Codex", "   ")).toEqual([
      { highlighted: false, key: "plain:0", text: "OpenAI Codex" },
    ]);
  });

  it("treats quote-wrapped blank queries as empty", () => {
    expect(buildSidebarSearchHighlightSegments("OpenAI Codex", ' "   " ')).toEqual([
      { highlighted: false, key: "plain:0", text: "OpenAI Codex" },
    ]);
  });

  it("highlights matching tokens from normalized queries", () => {
    expect(buildSidebarSearchHighlightSegments("OpenAI Codex", "  codex  ")).toEqual([
      { highlighted: false, key: "plain:0", text: "OpenAI " },
      { highlighted: true, key: "hit:7", text: "Codex" },
    ]);
  });
});
