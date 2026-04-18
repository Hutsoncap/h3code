import { describe, expect, it } from "vitest";

import {
  collectTerminalIdsFromLayout,
  findFirstTerminalIdInLayout,
  normalizeTerminalPaneGroup,
} from "./terminalPaneLayout";

describe("terminalPaneLayout", () => {
  it("ignores quote-wrapped blank terminal ids when collecting leaf terminal ids", () => {
    const node = {
      type: "terminal" as const,
      paneId: "pane-term-1",
      terminalIds: [' "   " ', "term-1", " '   ' "],
      activeTerminalId: ' "   " ',
    };

    expect(collectTerminalIdsFromLayout(node)).toEqual(["term-1"]);
    expect(findFirstTerminalIdInLayout(node)).toBe("term-1");
  });

  it("falls back to canonical group and pane ids when persisted ids are quote-wrapped blank", () => {
    const group = normalizeTerminalPaneGroup(
      {
        id: ' "   " ',
        activeTerminalId: "term-1",
        layout: {
          type: "terminal",
          paneId: " '   ' ",
          terminalIds: ["term-1"],
          activeTerminalId: "term-1",
        },
      },
      ["term-1"],
    );

    expect(group).toEqual({
      id: "group-term-1",
      activeTerminalId: "term-1",
      layout: {
        type: "terminal",
        paneId: "pane-term-1",
        terminalIds: ["term-1"],
        activeTerminalId: "term-1",
      },
    });
  });

  it("drops quote-wrapped blank legacy terminal ids before building fallback layouts", () => {
    const group = normalizeTerminalPaneGroup(
      {
        id: "group-1",
        activeTerminalId: ' "   " ',
        terminalIds: [' "   " ', "term-2"],
      },
      ["term-2"],
    );

    expect(group).toEqual({
      id: "group-1",
      activeTerminalId: "term-2",
      layout: {
        type: "terminal",
        paneId: "pane-term-2",
        terminalIds: ["term-2"],
        activeTerminalId: "term-2",
      },
    });
  });

  it("falls back to canonical split ids when persisted split ids are quote-wrapped blank", () => {
    const group = normalizeTerminalPaneGroup(
      {
        id: "group-1",
        activeTerminalId: "term-1",
        layout: {
          type: "split",
          id: ' "   " ',
          direction: "horizontal",
          children: [
            {
              type: "terminal",
              paneId: "pane-term-1",
              terminalIds: ["term-1"],
              activeTerminalId: "term-1",
            },
            {
              type: "terminal",
              paneId: "pane-term-2",
              terminalIds: ["term-2"],
              activeTerminalId: "term-2",
            },
          ],
          weights: [1, 1],
        },
      },
      ["term-1", "term-2"],
    );

    expect(group?.layout).toEqual({
      type: "split",
      id: "split-term-1",
      direction: "horizontal",
      children: [
        {
          type: "terminal",
          paneId: "pane-term-1",
          terminalIds: ["term-1"],
          activeTerminalId: "term-1",
        },
        {
          type: "terminal",
          paneId: "pane-term-2",
          terminalIds: ["term-2"],
          activeTerminalId: "term-2",
        },
      ],
      weights: [1, 1],
    });
  });
});
