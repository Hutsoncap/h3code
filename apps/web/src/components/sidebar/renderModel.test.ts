import { describe, expect, it } from "vitest";
import { ProjectId, ThreadId } from "@t3tools/contracts";

import type { Project, SidebarThreadSummary } from "../../types";
import type { SplitView } from "../../splitViewStore";
import { buildSidebarRenderModel } from "./renderModel";

function makeProject(input: {
  id: string;
  expanded?: boolean;
  createdAt?: string;
  updatedAt?: string;
}): Project {
  return {
    id: input.id as ProjectId,
    name: input.id,
    remoteName: input.id,
    folderName: input.id,
    localName: null,
    cwd: `/tmp/${input.id}`,
    defaultModelSelection: null,
    expanded: input.expanded ?? true,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    scripts: [],
  };
}

function makeThread(input: {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
  parentThreadId?: string | null;
}): SidebarThreadSummary {
  return {
    id: input.id as ThreadId,
    projectId: input.projectId as ProjectId,
    title: input.id,
    modelSelection: {
      provider: "codex",
      model: "gpt-5-codex",
    },
    interactionMode: "default",
    envMode: "local",
    worktreePath: null,
    session: null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    latestTurn: null,
    lastVisitedAt: undefined,
    parentThreadId: (input.parentThreadId ?? null) as ThreadId | null,
    subagentAgentId: null,
    subagentNickname: null,
    subagentRole: null,
    latestUserMessageAt: input.updatedAt ?? input.createdAt,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    hasLiveTailWork: false,
    forkSourceThreadId: null,
    handoff: null,
  };
}

function makeSplitView(input: {
  id: string;
  sourceThreadId: string;
  ownerProjectId: string;
}): SplitView {
  return {
    id: input.id,
    sourceThreadId: input.sourceThreadId as ThreadId,
    ownerProjectId: input.ownerProjectId as ProjectId,
    leftThreadId: input.sourceThreadId as ThreadId,
    rightThreadId: null,
    focusedPane: "right",
    ratio: 0.5,
    leftPanel: {
      panel: null,
      diffTurnId: null,
      diffFilePath: null,
      hasOpenedPanel: false,
      lastOpenPanel: "browser",
    },
    rightPanel: {
      panel: null,
      diffTurnId: null,
      diffFilePath: null,
      hasOpenedPanel: false,
      lastOpenPanel: "browser",
    },
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

describe("buildSidebarRenderModel", () => {
  it("keeps pinned rows ahead of project rows and filters them out of project entries", () => {
    const projects = [makeProject({ id: "project-a" }), makeProject({ id: "project-b" })];
    const threads = [
      makeThread({
        id: "thread-a-pinned",
        projectId: "project-a",
        createdAt: "2026-04-01T00:00:00.000Z",
      }),
      makeThread({
        id: "thread-a-visible",
        projectId: "project-a",
        createdAt: "2026-04-01T00:01:00.000Z",
      }),
      makeThread({
        id: "thread-b-visible",
        projectId: "project-b",
        createdAt: "2026-04-01T00:02:00.000Z",
      }),
    ];

    const renderModel = buildSidebarRenderModel({
      projects,
      sidebarThreads: threads,
      sidebarDisplayThreads: threads,
      splitViews: [],
      pinnedThreadIds: ["thread-a-pinned" as ThreadId],
      activeSidebarThreadId: undefined,
      expandedThreadListsByProject: new Set<ProjectId>(),
      expandedSubagentParentIds: new Set<ThreadId>(),
      projectSortOrder: "manual",
      threadSortOrder: "created_at",
      previewLimit: 5,
    });

    expect(renderModel.pinnedThreads.map((thread) => thread.id)).toEqual([
      "thread-a-pinned" as ThreadId,
    ]);
    expect(
      renderModel.projectRenderModels[0]?.visibleEntries.map((entry) => entry.rowId) ?? [],
    ).toEqual(["thread-a-visible" as ThreadId]);
    expect(renderModel.visibleSidebarThreadIds).toEqual([
      "thread-a-pinned" as ThreadId,
      "thread-a-visible" as ThreadId,
      "thread-b-visible" as ThreadId,
    ]);
  });

  it("keeps the active thread visible even when it falls past the preview limit", () => {
    const project = makeProject({ id: "project-preview" });
    const threads = Array.from({ length: 6 }, (_, index) =>
      makeThread({
        id: `thread-${index + 1}`,
        projectId: project.id,
        createdAt: `2026-04-01T00:0${index}:00.000Z`,
      }),
    );

    const renderModel = buildSidebarRenderModel({
      projects: [project],
      sidebarThreads: threads,
      sidebarDisplayThreads: threads,
      splitViews: [],
      pinnedThreadIds: [],
      activeSidebarThreadId: "thread-1" as ThreadId,
      expandedThreadListsByProject: new Set<ProjectId>(),
      expandedSubagentParentIds: new Set<ThreadId>(),
      projectSortOrder: "manual",
      threadSortOrder: "created_at",
      previewLimit: 5,
    });

    expect(renderModel.projectRenderModels[0]?.hasHiddenEntries).toBe(true);
    expect(
      renderModel.projectRenderModels[0]?.visibleEntries.map((entry) => entry.rowId) ?? [],
    ).toEqual([
      "thread-6" as ThreadId,
      "thread-5" as ThreadId,
      "thread-4" as ThreadId,
      "thread-3" as ThreadId,
      "thread-2" as ThreadId,
      "thread-1" as ThreadId,
    ]);
  });

  it("replaces source thread rows with split rows while preserving the row order", () => {
    const project = makeProject({ id: "project-split" });
    const threads = [
      makeThread({
        id: "thread-root",
        projectId: project.id,
        createdAt: "2026-04-01T00:01:00.000Z",
      }),
      makeThread({
        id: "thread-secondary",
        projectId: project.id,
        createdAt: "2026-04-01T00:00:00.000Z",
      }),
    ];

    const renderModel = buildSidebarRenderModel({
      projects: [project],
      sidebarThreads: threads,
      sidebarDisplayThreads: threads,
      splitViews: [
        makeSplitView({
          id: "split-1",
          sourceThreadId: "thread-root",
          ownerProjectId: project.id,
        }),
      ],
      pinnedThreadIds: [],
      activeSidebarThreadId: undefined,
      expandedThreadListsByProject: new Set<ProjectId>(),
      expandedSubagentParentIds: new Set<ThreadId>(),
      projectSortOrder: "manual",
      threadSortOrder: "created_at",
      previewLimit: 5,
    });

    expect(renderModel.projectRenderModels[0]?.visibleEntries).toMatchObject([
      { kind: "split", rowId: "thread-root" },
      { kind: "thread", rowId: "thread-secondary" },
    ]);
    expect(renderModel.visibleSidebarThreadIds).toEqual([
      "thread-root" as ThreadId,
      "thread-secondary" as ThreadId,
    ]);
  });
});
