import { Profiler, useMemo, type ProfilerOnRenderCallback } from "react";
import { ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import type { Project, SidebarThreadSummary } from "../../types";
import { buildSidebarRenderModel, type BuildSidebarRenderModelInput } from "./renderModel";

const PROJECT_COUNT = 50;
const THREAD_COUNT = 1_000;
const PINNED_THREAD_COUNT = 20;
const PREVIEW_LIMIT = 5;
const MAX_MOUNT_COMMITS = 1;
const MAX_MOUNT_DURATION_MS = 250;

function makeProject(index: number): Project {
  const id = `workspace-${index + 1}` as ProjectId;
  return {
    id,
    name: `Workspace ${index + 1}`,
    remoteName: `Workspace ${index + 1}`,
    folderName: `workspace-${index + 1}`,
    localName: null,
    cwd: `/tmp/workspace-${index + 1}`,
    defaultModelSelection: null,
    expanded: true,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    scripts: [],
  };
}

function makeThread(index: number, projectId: ProjectId): SidebarThreadSummary {
  const minute = String(index % 60).padStart(2, "0");
  const hour = String(Math.floor(index / 60)).padStart(2, "0");
  return {
    id: `thread-${index + 1}` as ThreadId,
    projectId,
    title: `Thread ${index + 1}`,
    modelSelection: {
      provider: "codex",
      model: "gpt-5-codex",
    },
    interactionMode: "default",
    envMode: "local",
    worktreePath: null,
    session: null,
    createdAt: `2026-04-01T${hour}:${minute}:00.000Z`,
    updatedAt: `2026-04-01T${hour}:${minute}:30.000Z`,
    latestTurn: null,
    lastVisitedAt: undefined,
    parentThreadId: null,
    subagentAgentId: null,
    subagentNickname: null,
    subagentRole: null,
    latestUserMessageAt: `2026-04-01T${hour}:${minute}:30.000Z`,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    hasLiveTailWork: false,
    forkSourceThreadId: null,
    handoff: null,
  };
}

function createFixture(): BuildSidebarRenderModelInput {
  const projects = Array.from({ length: PROJECT_COUNT }, (_, index) => makeProject(index));
  const threads = Array.from({ length: THREAD_COUNT }, (_, index) =>
    makeThread(index, projects[index % projects.length]!.id),
  );

  return {
    projects,
    sidebarThreads: threads,
    sidebarDisplayThreads: threads,
    splitViews: [],
    pinnedThreadIds: threads.slice(0, PINNED_THREAD_COUNT).map((thread) => thread.id),
    activeSidebarThreadId: undefined,
    expandedThreadListsByProject: new Set(projects.map((project) => project.id)),
    expandedSubagentParentIds: new Set<ThreadId>(),
    projectSortOrder: "manual",
    threadSortOrder: "updated_at",
    previewLimit: PREVIEW_LIMIT,
  };
}

function SidebarRenderBudgetHarness(props: {
  input: BuildSidebarRenderModelInput;
  onRender: ProfilerOnRenderCallback;
}) {
  const renderModel = useMemo(() => buildSidebarRenderModel(props.input), [props.input]);

  return (
    <Profiler id="sidebar-render-budget" onRender={props.onRender}>
      <div data-testid="sidebar-render-budget">
        <div data-testid="pinned-count">{renderModel.pinnedThreads.length}</div>
        {renderModel.projectRenderModels.map((projectModel) => (
          <section key={projectModel.project.id} data-project-id={projectModel.project.id}>
            <header>{projectModel.project.name}</header>
            <div>
              {projectModel.visibleEntries.map((entry) => (
                <div key={`${entry.kind}:${entry.rowId}`}>{entry.rowId}</div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Profiler>
  );
}

describe("sidebar render budget", () => {
  it("stays within the large-fixture mount budget", async () => {
    const input = createFixture();
    const samples: Array<{ phase: string; actualDuration: number }> = [];
    const screen = await render(
      <SidebarRenderBudgetHarness
        input={input}
        onRender={(_id, phase, actualDuration) => {
          samples.push({ phase, actualDuration });
        }}
      />,
    );

    await expect
      .element(screen.getByTestId("pinned-count"))
      .toHaveTextContent(String(PINNED_THREAD_COUNT));

    const mountSamples = samples.filter((sample) => sample.phase === "mount");
    const maxMountDuration = Math.max(...mountSamples.map((sample) => sample.actualDuration), 0);

    expect(mountSamples).toHaveLength(MAX_MOUNT_COMMITS);
    expect(maxMountDuration).toBeLessThan(MAX_MOUNT_DURATION_MS);
  });
});
