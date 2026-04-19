import { describe, expect, it } from "vitest";
import { buildPinnedSidebarEntries } from "./pinnedEntries";

describe("buildPinnedSidebarEntries", () => {
  it("preserves store order while mixing thread and workspace entries", () => {
    const result = buildPinnedSidebarEntries({
      pinnedItems: [
        { kind: "workspace", id: "workspace-1" },
        { kind: "thread", id: "thread-2" },
        { kind: "thread", id: "missing-thread" },
        { kind: "webapp", id: "webapp-1" },
        { kind: "thread", id: "thread-1" },
      ],
      threads: [{ id: "thread-1" }, { id: "thread-2" }],
      workspaces: [{ id: "workspace-1" }, { id: "workspace-2" }],
    });

    expect(result.pinnedEntries).toMatchObject([
      { kind: "workspace", workspace: { id: "workspace-1" } },
      { kind: "thread", thread: { id: "thread-2" } },
      { kind: "thread", thread: { id: "thread-1" } },
    ]);
    expect(result.pinnedThreadIds).toEqual(["thread-2", "thread-1"]);
    expect(result.pinnedWorkspaceIds).toEqual(["workspace-1"]);
  });
});
