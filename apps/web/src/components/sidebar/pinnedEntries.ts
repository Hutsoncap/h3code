import type { PinnedItem } from "../../pinnedItemsStore";

export type PinnedSidebarEntry<
  TThread extends { id: string },
  TWorkspace extends { id: string },
  TWebApp extends { id: string },
> =
  | {
      kind: "thread";
      itemKey: string;
      thread: TThread;
    }
  | {
      kind: "workspace";
      itemKey: string;
      workspace: TWorkspace;
    }
  | {
      kind: "webapp";
      itemKey: string;
      webApp: TWebApp;
    };

export interface BuildPinnedSidebarEntriesResult<
  TThread extends { id: string },
  TWorkspace extends { id: string },
  TWebApp extends { id: string },
> {
  pinnedEntries: Array<PinnedSidebarEntry<TThread, TWorkspace, TWebApp>>;
  pinnedThreadIds: string[];
  pinnedWorkspaceIds: string[];
  pinnedWebAppIds: string[];
}

export function buildPinnedSidebarEntries<
  TThread extends { id: string },
  TWorkspace extends { id: string },
  TWebApp extends { id: string },
>(input: {
  pinnedItems: readonly PinnedItem[];
  threads: readonly TThread[];
  workspaces: readonly TWorkspace[];
  webApps: readonly TWebApp[];
}): BuildPinnedSidebarEntriesResult<TThread, TWorkspace, TWebApp> {
  const threadById = new Map(input.threads.map((thread) => [thread.id, thread] as const));
  const workspaceById = new Map(
    input.workspaces.map((workspace) => [workspace.id, workspace] as const),
  );
  const webAppById = new Map(input.webApps.map((webApp) => [webApp.id, webApp] as const));

  const pinnedEntries: Array<PinnedSidebarEntry<TThread, TWorkspace, TWebApp>> = [];
  const pinnedThreadIds: string[] = [];
  const pinnedWorkspaceIds: string[] = [];
  const pinnedWebAppIds: string[] = [];

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
      continue;
    }

    if (item.kind === "webapp") {
      const webApp = webAppById.get(item.id);
      if (!webApp) {
        continue;
      }

      pinnedWebAppIds.push(item.id);
      pinnedEntries.push({
        kind: "webapp",
        itemKey: `webapp:${item.id}`,
        webApp,
      });
    }
  }

  return {
    pinnedEntries,
    pinnedThreadIds,
    pinnedWorkspaceIds,
    pinnedWebAppIds,
  };
}
