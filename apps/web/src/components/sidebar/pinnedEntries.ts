import type { PinnedItem } from "../../pinnedItemsStore";

export type PinnedSidebarEntry<TThread extends { id: string }, TWorkspace extends { id: string }> =
  | {
      kind: "thread";
      itemKey: string;
      thread: TThread;
    }
  | {
      kind: "workspace";
      itemKey: string;
      workspace: TWorkspace;
    };

export interface BuildPinnedSidebarEntriesResult<
  TThread extends { id: string },
  TWorkspace extends { id: string },
> {
  pinnedEntries: Array<PinnedSidebarEntry<TThread, TWorkspace>>;
  pinnedThreadIds: string[];
  pinnedWorkspaceIds: string[];
}

export function buildPinnedSidebarEntries<
  TThread extends { id: string },
  TWorkspace extends { id: string },
>(input: {
  pinnedItems: readonly PinnedItem[];
  threads: readonly TThread[];
  workspaces: readonly TWorkspace[];
}): BuildPinnedSidebarEntriesResult<TThread, TWorkspace> {
  const threadById = new Map(input.threads.map((thread) => [thread.id, thread] as const));
  const workspaceById = new Map(
    input.workspaces.map((workspace) => [workspace.id, workspace] as const),
  );

  const pinnedEntries: Array<PinnedSidebarEntry<TThread, TWorkspace>> = [];
  const pinnedThreadIds: string[] = [];
  const pinnedWorkspaceIds: string[] = [];

  for (const item of input.pinnedItems) {
    if (item.kind === "thread") {
      const thread = threadById.get(item.id);
      if (!thread) {
        continue;
      }

      pinnedThreadIds.push(item.id);
      pinnedEntries.push({
        kind: "thread",
        itemKey: `thread:${item.id}`,
        thread,
      });
      continue;
    }

    if (item.kind === "workspace") {
      const workspace = workspaceById.get(item.id);
      if (!workspace) {
        continue;
      }

      pinnedWorkspaceIds.push(item.id);
      pinnedEntries.push({
        kind: "workspace",
        itemKey: `workspace:${item.id}`,
        workspace,
      });
    }
  }

  return {
    pinnedEntries,
    pinnedThreadIds,
    pinnedWorkspaceIds,
  };
}
