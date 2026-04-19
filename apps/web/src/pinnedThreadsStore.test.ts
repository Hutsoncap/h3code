// FILE: pinnedThreadsStore.test.ts
// Purpose: Verifies the global pinned-thread store mutates ids predictably.
// Layer: UI state store test

import { beforeEach, describe, expect, it } from "vitest";
import { ThreadId } from "@t3tools/contracts";
import { usePinnedItemsStore } from "./pinnedItemsStore";
import { usePinnedThreadsStore } from "./pinnedThreadsStore";

describe("usePinnedThreadsStore", () => {
  beforeEach(() => {
    usePinnedItemsStore.setState({ pinnedItems: [] });
  });

  it("toggles a pinned thread id on and off", () => {
    usePinnedThreadsStore.getState().togglePinnedThread("thread-1" as ThreadId);
    expect(usePinnedThreadsStore.getState().pinnedThreadIds).toEqual(["thread-1"]);

    usePinnedThreadsStore.getState().togglePinnedThread("thread-1" as ThreadId);
    expect(usePinnedThreadsStore.getState().pinnedThreadIds).toEqual([]);
  });

  it("prunes thread ids that are no longer present", () => {
    usePinnedItemsStore.setState({
      pinnedItems: [
        { kind: "thread", id: "thread-2" as ThreadId },
        { kind: "thread", id: "thread-1" as ThreadId },
      ],
    });

    usePinnedThreadsStore.getState().prunePinnedThreads(["thread-1" as ThreadId]);
    expect(usePinnedThreadsStore.getState().pinnedThreadIds).toEqual(["thread-1"]);
  });

  it("ignores non-thread pinned items from the generalized store", () => {
    usePinnedItemsStore.setState({
      pinnedItems: [
        { kind: "workspace", id: "workspace-1" },
        { kind: "thread", id: "thread-1" as ThreadId },
      ],
    });

    expect(usePinnedThreadsStore.getState().pinnedThreadIds).toEqual(["thread-1"]);
  });
});
