import { describe, expect, it } from "vitest";

import { resolveThreadTerminalLayout } from "./TerminalLayout";

describe("TerminalLayout", () => {
  it("ignores quote-wrapped blank terminal ids when resolving layout", () => {
    const result = resolveThreadTerminalLayout({
      activeTerminalGroupId: ' "   " ',
      activeTerminalId: ' "   " ',
      runningTerminalIds: [],
      terminalAttentionStatesById: {},
      terminalCliKindsById: {},
      terminalGroups: [],
      terminalIds: [' "   " ', "term-1", " '   ' "],
      terminalLabelsById: {},
      terminalTitleOverridesById: {},
    });

    expect(result.normalizedTerminalIds).toEqual(["term-1"]);
    expect(result.resolvedActiveGroupId).toBe("group-term-1");
    expect(result.resolvedActiveTerminalId).toBe("term-1");
    expect(result.visibleTerminalIds).toEqual(["term-1"]);
  });

  it("does not treat quote-wrapped blank running ids as active work", () => {
    const result = resolveThreadTerminalLayout({
      activeTerminalGroupId: "group-term-1",
      activeTerminalId: "term-1",
      runningTerminalIds: [' "   " '],
      terminalAttentionStatesById: {},
      terminalCliKindsById: {},
      terminalGroups: [],
      terminalIds: ["term-1"],
      terminalLabelsById: {},
      terminalTitleOverridesById: {},
    });

    expect(result.terminalVisualIdentityById.get("term-1")).toMatchObject({
      title: "Terminal 1",
      state: "idle",
    });
  });

  it("falls back to the first valid terminal when the active terminal id is quote-wrapped blank", () => {
    const result = resolveThreadTerminalLayout({
      activeTerminalGroupId: "group-term-1",
      activeTerminalId: ' "   " ',
      runningTerminalIds: [],
      terminalAttentionStatesById: {},
      terminalCliKindsById: {},
      terminalGroups: [],
      terminalIds: ["term-1", "term-2"],
      terminalLabelsById: {},
      terminalTitleOverridesById: {},
    });

    expect(result.resolvedActiveTerminalId).toBe("term-1");
    expect(result.resolvedActiveGroupId).toBe("group-term-1");
  });
});
