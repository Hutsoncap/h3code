import type { ProjectId, ThreadId } from "@t3tools/contracts";

import type { SidebarProjectSortOrder, SidebarThreadSortOrder } from "../../appSettings";
import type { SplitView } from "../../splitViewStore";
import type { Project, SidebarThreadSummary } from "../../types";
import {
  buildProjectThreadTree,
  getPinnedThreadsForSidebar,
  getUnpinnedThreadsForSidebar,
  getVisibleSidebarEntriesForPreview,
  resolveProjectStatusIndicator,
  resolveThreadStatusPill,
  sortProjectsForSidebar,
  sortThreadsForSidebar,
  type ThreadStatusPill,
} from "../Sidebar.logic";

export type SidebarProjectRenderEntry =
  | {
      kind: "thread";
      rowId: ThreadId;
      rootRowId: ThreadId;
      thread: SidebarThreadSummary;
      depth: number;
      childCount: number;
      isExpanded: boolean;
    }
  | {
      kind: "split";
      rowId: ThreadId;
      rootRowId: ThreadId;
      splitView: SplitView;
    };

export interface SidebarProjectRenderModel {
  project: Project;
  projectStatus: ThreadStatusPill | null;
  orderedProjectThreadIds: ThreadId[];
  hasHiddenEntries: boolean;
  visibleEntries: SidebarProjectRenderEntry[];
}

export interface SidebarRenderModel {
  pinnedThreads: SidebarThreadSummary[];
  projectRenderModels: SidebarProjectRenderModel[];
  visibleSidebarThreadIds: ThreadId[];
}

export interface BuildSidebarRenderModelInput {
  projects: readonly Project[];
  sidebarThreads: readonly SidebarThreadSummary[];
  sidebarDisplayThreads: readonly SidebarThreadSummary[];
  splitViews: readonly SplitView[];
  pinnedThreadIds: readonly ThreadId[];
  activeSidebarThreadId: ThreadId | undefined;
  expandedThreadListsByProject: ReadonlySet<ProjectId>;
  expandedSubagentParentIds: ReadonlySet<ThreadId>;
  projectSortOrder: SidebarProjectSortOrder;
  threadSortOrder: SidebarThreadSortOrder;
  previewLimit: number;
}

type SidebarPreviewEntry = {
  rowId: ThreadId;
  rootRowId: ThreadId;
};

function buildRenderEntries(input: {
  projectThreadTree: ReturnType<typeof buildProjectThreadTree<SidebarThreadSummary>>;
  splitViewBySourceThreadId: ReadonlyMap<ThreadId, SplitView>;
}): SidebarProjectRenderEntry[] {
  return input.projectThreadTree.map(({ thread, depth, rootThreadId, childCount, isExpanded }) => {
    const splitView = input.splitViewBySourceThreadId.get(thread.id);
    if (!splitView) {
      return {
        kind: "thread",
        rowId: thread.id,
        rootRowId: rootThreadId,
        thread,
        depth,
        childCount,
        isExpanded,
      };
    }
    return {
      kind: "split",
      rowId: splitView.sourceThreadId,
      rootRowId: rootThreadId,
      splitView,
    };
  });
}

function buildVisibilityEntries(input: {
  projectThreadTree: ReturnType<typeof buildProjectThreadTree<SidebarThreadSummary>>;
  splitViewBySourceThreadId: ReadonlyMap<ThreadId, SplitView>;
  projectSplitViews: readonly SplitView[];
}): SidebarPreviewEntry[] {
  const orderedEntries = input.projectThreadTree.map((row) => ({
    rowId: input.splitViewBySourceThreadId.get(row.thread.id)?.sourceThreadId ?? row.thread.id,
    rootRowId: row.rootThreadId,
  }));

  for (const splitView of input.projectSplitViews) {
    if (orderedEntries.some((entry) => entry.rowId === splitView.sourceThreadId)) {
      continue;
    }
    orderedEntries.push({
      rowId: splitView.sourceThreadId,
      rootRowId: splitView.sourceThreadId,
    });
  }

  return orderedEntries;
}

export function buildSidebarRenderModel(input: BuildSidebarRenderModelInput): SidebarRenderModel {
  const sortedProjects = sortProjectsForSidebar(
    input.projects,
    input.sidebarThreads,
    input.projectSortOrder,
  );
  const pinnedThreads = getPinnedThreadsForSidebar(
    input.sidebarDisplayThreads,
    input.pinnedThreadIds,
  );
  const pinnedThreadIdSet = new Set(input.pinnedThreadIds);
  const splitViewBySourceThreadId = new Map(
    input.splitViews.map((splitView) => [splitView.sourceThreadId, splitView] as const),
  );
  const displayThreadsByProjectId = new Map<ProjectId, SidebarThreadSummary[]>();
  const splitViewsByProjectId = new Map<ProjectId, SplitView[]>();

  for (const thread of input.sidebarDisplayThreads) {
    const existing = displayThreadsByProjectId.get(thread.projectId) ?? [];
    existing.push(thread);
    displayThreadsByProjectId.set(thread.projectId, existing);
  }

  for (const splitView of input.splitViews) {
    const existing = splitViewsByProjectId.get(splitView.ownerProjectId) ?? [];
    existing.push(splitView);
    splitViewsByProjectId.set(splitView.ownerProjectId, existing);
  }

  const visibleSidebarThreadIds = pinnedThreads.map((thread) => thread.id);
  const projectRenderModels: SidebarProjectRenderModel[] = [];

  for (const project of sortedProjects) {
    const allProjectThreads = sortThreadsForSidebar(
      displayThreadsByProjectId.get(project.id) ?? [],
      input.threadSortOrder,
    );
    const projectThreads = getUnpinnedThreadsForSidebar(allProjectThreads, input.pinnedThreadIds);
    const projectThreadTree = buildProjectThreadTree({
      threads: projectThreads,
      expandedParentThreadIds: input.expandedSubagentParentIds,
    });
    const projectSplitViews = (splitViewsByProjectId.get(project.id) ?? []).filter(
      (splitView) => !pinnedThreadIdSet.has(splitView.sourceThreadId),
    );
    const renderEntries = buildRenderEntries({
      projectThreadTree,
      splitViewBySourceThreadId,
    });
    const activeRenderEntry =
      input.activeSidebarThreadId === undefined
        ? null
        : (renderEntries.find((entry) => entry.rowId === input.activeSidebarThreadId) ?? null);
    const { hasHiddenEntries, visibleEntries: previewEntries } = getVisibleSidebarEntriesForPreview(
      {
        entries: renderEntries,
        activeEntryId: activeRenderEntry?.rowId,
        isExpanded: input.expandedThreadListsByProject.has(project.id),
        previewLimit: input.previewLimit,
      },
    );
    const visibleEntries =
      !project.expanded && activeRenderEntry ? [activeRenderEntry] : previewEntries;

    projectRenderModels.push({
      project,
      projectStatus: resolveProjectStatusIndicator(
        allProjectThreads.map((thread) =>
          resolveThreadStatusPill({
            thread,
            hasPendingApprovals: thread.hasPendingApprovals,
            hasPendingUserInput: thread.hasPendingUserInput,
          }),
        ),
      ),
      orderedProjectThreadIds: projectThreads.map((thread) => thread.id),
      hasHiddenEntries,
      visibleEntries,
    });

    const visibilityEntries = buildVisibilityEntries({
      projectThreadTree,
      splitViewBySourceThreadId,
      projectSplitViews,
    });
    const { visibleEntries: previewVisibilityEntries } = getVisibleSidebarEntriesForPreview({
      entries: visibilityEntries,
      activeEntryId:
        input.activeSidebarThreadId &&
        visibilityEntries.some((entry) => entry.rowId === input.activeSidebarThreadId)
          ? input.activeSidebarThreadId
          : undefined,
      isExpanded: input.expandedThreadListsByProject.has(project.id),
      previewLimit: input.previewLimit,
    });

    if (!project.expanded) {
      if (
        input.activeSidebarThreadId &&
        visibilityEntries.some((entry) => entry.rowId === input.activeSidebarThreadId)
      ) {
        visibleSidebarThreadIds.push(input.activeSidebarThreadId);
      }
      continue;
    }

    visibleSidebarThreadIds.push(...previewVisibilityEntries.map((entry) => entry.rowId));
  }

  return {
    pinnedThreads,
    projectRenderModels,
    visibleSidebarThreadIds,
  };
}
