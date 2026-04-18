import { describe, expect, it } from "vitest";

import {
  createWorkspaceTerminalGroupFromPreset,
  ensureTerminalIdsForPreset,
} from "./workspaceTerminalLayoutPresets";

describe("workspaceTerminalLayoutPresets", () => {
  it("ignores quote-wrapped blank terminal ids when creating a preset group", () => {
    expect(
      createWorkspaceTerminalGroupFromPreset({
        presetId: "single",
        terminalIds: [' "   " ', "term-1"],
      }),
    ).toEqual({
      id: "workspace-group-single",
      activeTerminalId: "term-1",
      layout: {
        type: "terminal",
        paneId: "pane-single-1",
        terminalIds: ["term-1"],
        activeTerminalId: "term-1",
      },
    });
  });

  it("skips quote-wrapped blank generated ids while filling preset slots", () => {
    const generatedIds = [' "   " ', "term-2"];

    const ids = ensureTerminalIdsForPreset(["term-1"], "two-columns", () => {
      return generatedIds.shift() ?? "term-fallback";
    });

    expect(ids).toEqual(["term-1", "term-2"]);
  });

  it("falls back to the first valid terminal when active terminal id is quote-wrapped blank", () => {
    expect(
      createWorkspaceTerminalGroupFromPreset({
        presetId: "single",
        terminalIds: [' "   " ', "term-1"],
        activeTerminalId: ' "   " ',
      }),
    ).toEqual({
      id: "workspace-group-single",
      activeTerminalId: "term-1",
      layout: {
        type: "terminal",
        paneId: "pane-single-1",
        terminalIds: ["term-1"],
        activeTerminalId: "term-1",
      },
    });
  });
});
