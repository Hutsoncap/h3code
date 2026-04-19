// FILE: pinnedThreadsStore.ts
// Purpose: Back-compat thread pin selector wrapper over the generalized pinned-items store.
// Layer: UI state store
// Exports: usePinnedThreadsStore

import { type ThreadId } from "@t3tools/contracts";
import { create } from "zustand";
import { type PinnedItem, usePinnedItemsStore } from "./pinnedItemsStore";

interface PinnedThreadsStoreState {
  pinnedThreadIds: ThreadId[];
  pinThread: (threadId: ThreadId) => void;
  unpinThread: (threadId: ThreadId) => void;
  togglePinnedThread: (threadId: ThreadId) => void;
  prunePinnedThreads: (threadIds: readonly ThreadId[]) => void;
}

function normalizePinnedThreadIds(threadIds: readonly ThreadId[]): ThreadId[] {
  const seen = new Set<ThreadId>();
  const normalized: ThreadId[] = [];

  for (const threadId of threadIds) {
    if (threadId.length === 0 || seen.has(threadId)) {
      continue;
    }
    seen.add(threadId);
    normalized.push(threadId);
  }

  return normalized;
}

function selectPinnedThreadIds(pinnedItems: readonly PinnedItem[]): ThreadId[] {
  return normalizePinnedThreadIds(
    pinnedItems
      .filter((item): item is PinnedItem & { kind: "thread" } => item.kind === "thread")
      .map((item) => item.id as ThreadId),
  );
}

function sameThreadIds(a: readonly ThreadId[], b: readonly ThreadId[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((threadId, index) => threadId === b[index]);
}

export const usePinnedThreadsStore = create<PinnedThreadsStoreState>(() => ({
  pinnedThreadIds: selectPinnedThreadIds(usePinnedItemsStore.getState().pinnedItems),
  pinThread: (threadId) => {
    if (threadId.length === 0) return;
    usePinnedItemsStore.getState().pinItem({ kind: "thread", id: threadId });
  },
  unpinThread: (threadId) => {
    if (threadId.length === 0) return;
    usePinnedItemsStore.getState().unpinItem({ kind: "thread", id: threadId });
  },
  togglePinnedThread: (threadId) => {
    if (threadId.length === 0) return;
    usePinnedItemsStore.getState().togglePin({ kind: "thread", id: threadId });
  },
  prunePinnedThreads: (threadIds) => {
    usePinnedItemsStore.getState().prune({ thread: threadIds });
  },
}));

function syncPinnedThreadIds(): void {
  const nextPinnedThreadIds = selectPinnedThreadIds(usePinnedItemsStore.getState().pinnedItems);
  usePinnedThreadsStore.setState((state) =>
    sameThreadIds(state.pinnedThreadIds, nextPinnedThreadIds)
      ? state
      : { pinnedThreadIds: nextPinnedThreadIds },
  );
}

syncPinnedThreadIds();
usePinnedItemsStore.subscribe(syncPinnedThreadIds);
