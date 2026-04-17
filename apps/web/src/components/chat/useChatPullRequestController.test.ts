import { ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE, type Project } from "../../types";
import type { DraftThreadState } from "../../composerDraftStore";
import { openOrReuseProjectDraftThread } from "./useChatPullRequestController";

function makeProject(): Project {
  return {
    id: ProjectId.makeUnsafe("project-1"),
    name: "Project 1",
    remoteName: "origin",
    folderName: "project-1",
    localName: null,
    cwd: "/tmp/project-1",
    defaultModelSelection: null,
    expanded: true,
    scripts: [],
  };
}

function makeDraftThread(overrides: Partial<DraftThreadState> = {}): DraftThreadState {
  return {
    projectId: ProjectId.makeUnsafe("project-1"),
    createdAt: "2026-04-17T00:00:00.000Z",
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    entryPoint: "chat",
    branch: null,
    worktreePath: null,
    envMode: "local",
    ...overrides,
  };
}

describe("openOrReuseProjectDraftThread", () => {
  it("reuses an existing draft thread for the active project", async () => {
    const activeProject = makeProject();
    const draftThreadInput = {
      branch: "feature/pr-123",
      worktreePath: "/tmp/project-1/.worktrees/pr-123",
      envMode: "worktree" as const,
    };
    const storedThreadId = ThreadId.makeUnsafe("thread-stored");
    const currentThreadId = ThreadId.makeUnsafe("thread-current");
    const getDraftThreadByProjectId = vi.fn(() => ({
      threadId: storedThreadId,
      projectId: activeProject.id,
      entryPoint: "chat" as const,
    }));
    const getDraftThread = vi.fn(() => null);
    const setDraftThreadContext = vi.fn();
    const setProjectDraftThreadId = vi.fn();
    const clearProjectDraftThreadId = vi.fn();
    const navigate = vi.fn();

    await openOrReuseProjectDraftThread({
      activeProject,
      canCheckoutPullRequestIntoThread: true,
      currentThreadId,
      getDraftThreadByProjectId,
      getDraftThread,
      setDraftThreadContext,
      setProjectDraftThreadId,
      clearProjectDraftThreadId,
      navigate,
      clearComposerHighlightedItemId: vi.fn(),
      isServerThread: false,
      draftThreadInput,
    });

    expect(setDraftThreadContext).toHaveBeenCalledWith(storedThreadId, draftThreadInput);
    expect(setProjectDraftThreadId).toHaveBeenCalledWith(
      activeProject.id,
      storedThreadId,
      draftThreadInput,
    );
    expect(clearProjectDraftThreadId).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({
      to: "/$threadId",
      params: { threadId: storedThreadId },
    });
  });

  it("updates the current draft thread without navigation when it can be reused", async () => {
    const activeProject = makeProject();
    const draftThreadInput = {
      branch: "feature/pr-456",
      worktreePath: null,
      envMode: "local" as const,
    };
    const currentThreadId = ThreadId.makeUnsafe("thread-current");
    const existingDraftThread = makeDraftThread({ projectId: activeProject.id });
    const getDraftThreadByProjectId = vi.fn(() => null);
    const getDraftThread = vi.fn(() => existingDraftThread);
    const setDraftThreadContext = vi.fn();
    const setProjectDraftThreadId = vi.fn();
    const clearProjectDraftThreadId = vi.fn();
    const navigate = vi.fn();

    await openOrReuseProjectDraftThread({
      activeProject,
      canCheckoutPullRequestIntoThread: true,
      currentThreadId,
      getDraftThreadByProjectId,
      getDraftThread,
      setDraftThreadContext,
      setProjectDraftThreadId,
      clearProjectDraftThreadId,
      navigate,
      clearComposerHighlightedItemId: vi.fn(),
      isServerThread: false,
      draftThreadInput,
    });

    expect(setDraftThreadContext).toHaveBeenCalledWith(currentThreadId, draftThreadInput);
    expect(setProjectDraftThreadId).toHaveBeenCalledWith(
      activeProject.id,
      currentThreadId,
      draftThreadInput,
    );
    expect(clearProjectDraftThreadId).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("creates a new draft thread when no reusable draft exists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T12:00:00.000Z"));

    try {
      const activeProject = makeProject();
      const draftThreadInput = {
        branch: "feature/pr-789",
        worktreePath: "/tmp/project-1/.worktrees/pr-789",
        envMode: "worktree" as const,
      };
      const currentThreadId = ThreadId.makeUnsafe("thread-current");
      const getDraftThreadByProjectId = vi.fn(() => null);
      const getDraftThread = vi.fn(() => null);
      const setDraftThreadContext = vi.fn();
      const setProjectDraftThreadId = vi.fn();
      const clearProjectDraftThreadId = vi.fn();
      const navigate = vi.fn();

      await openOrReuseProjectDraftThread({
        activeProject,
        canCheckoutPullRequestIntoThread: true,
        currentThreadId,
        getDraftThreadByProjectId,
        getDraftThread,
        setDraftThreadContext,
        setProjectDraftThreadId,
        clearProjectDraftThreadId,
        navigate,
        clearComposerHighlightedItemId: vi.fn(),
        isServerThread: false,
        draftThreadInput,
      });

      expect(clearProjectDraftThreadId).toHaveBeenCalledWith(activeProject.id);
      expect(setProjectDraftThreadId).toHaveBeenCalledTimes(1);
      const [projectId, threadId, options] = setProjectDraftThreadId.mock.calls[0] ?? [];
      expect(projectId).toBe(activeProject.id);
      expect(threadId).toBeTypeOf("string");
      expect(threadId).not.toBe(currentThreadId);
      expect(options).toEqual({
        createdAt: "2026-04-17T12:00:00.000Z",
        runtimeMode: DEFAULT_RUNTIME_MODE,
        interactionMode: DEFAULT_INTERACTION_MODE,
        ...draftThreadInput,
      });
      expect(navigate).toHaveBeenCalledWith({
        to: "/$threadId",
        params: { threadId },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
