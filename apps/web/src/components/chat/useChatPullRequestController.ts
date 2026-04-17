import {
  type ProjectId,
  type ThreadId,
  type RuntimeMode,
  type ProviderInteractionMode,
} from "@t3tools/contracts";
import { useCallback, useEffect, useState } from "react";

import { newThreadId } from "../../lib/utils";
import type { DraftThreadEnvMode, DraftThreadState } from "../../composerDraftStore";
import {
  DEFAULT_INTERACTION_MODE,
  DEFAULT_RUNTIME_MODE,
  type Project,
  type ThreadPrimarySurface,
} from "../../types";
import type { PullRequestDialogState } from "../ChatView.logic";

type DraftThreadContextInput = {
  branch: string;
  worktreePath: string | null;
  envMode: DraftThreadEnvMode;
  createdAt?: string;
  runtimeMode?: RuntimeMode;
  interactionMode?: ProviderInteractionMode;
};

type NavigateToThread = (input: {
  to: "/$threadId";
  params: { threadId: ThreadId };
}) => Promise<void> | void;

interface ProjectDraftThreadRef {
  threadId: ThreadId;
  projectId: ProjectId;
  entryPoint: ThreadPrimarySurface;
}

interface UseChatPullRequestControllerOptions {
  activeProject: Project | undefined;
  canCheckoutPullRequestIntoThread: boolean;
  currentThreadId: ThreadId;
  getDraftThreadByProjectId: (projectId: ProjectId) => ProjectDraftThreadRef | null;
  getDraftThread: (threadId: ThreadId) => DraftThreadState | null;
  setDraftThreadContext: (threadId: ThreadId, input: DraftThreadContextInput) => void;
  setProjectDraftThreadId: (
    projectId: ProjectId,
    threadId: ThreadId,
    input: DraftThreadContextInput,
  ) => void;
  clearProjectDraftThreadId: (projectId: ProjectId) => void;
  navigate: NavigateToThread;
  clearComposerHighlightedItemId: () => void;
  isServerThread: boolean;
}

interface UseChatPullRequestControllerResult {
  pullRequestDialogState: PullRequestDialogState | null;
  openPullRequestDialog: (reference?: string) => void;
  closePullRequestDialog: () => void;
  handlePreparedPullRequestThread: (input: {
    branch: string;
    worktreePath: string | null;
  }) => Promise<void>;
}

export async function openOrReuseProjectDraftThread(
  input: UseChatPullRequestControllerOptions & {
    draftThreadInput: DraftThreadContextInput;
  },
): Promise<void> {
  const { activeProject } = input;
  if (!activeProject) {
    throw new Error("No active project is available for this pull request.");
  }

  const storedDraftThread = input.getDraftThreadByProjectId(activeProject.id);
  if (storedDraftThread) {
    input.setDraftThreadContext(storedDraftThread.threadId, input.draftThreadInput);
    input.setProjectDraftThreadId(
      activeProject.id,
      storedDraftThread.threadId,
      input.draftThreadInput,
    );
    if (storedDraftThread.threadId !== input.currentThreadId) {
      await input.navigate({
        to: "/$threadId",
        params: { threadId: storedDraftThread.threadId },
      });
    }
    return;
  }

  const activeDraftThread = input.getDraftThread(input.currentThreadId);
  if (
    !input.isServerThread &&
    activeDraftThread?.projectId === activeProject.id &&
    activeDraftThread.entryPoint === "chat"
  ) {
    input.setDraftThreadContext(input.currentThreadId, input.draftThreadInput);
    input.setProjectDraftThreadId(activeProject.id, input.currentThreadId, input.draftThreadInput);
    return;
  }

  input.clearProjectDraftThreadId(activeProject.id);
  const nextThreadId = newThreadId();
  input.setProjectDraftThreadId(activeProject.id, nextThreadId, {
    createdAt: new Date().toISOString(),
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    ...input.draftThreadInput,
  });
  await input.navigate({
    to: "/$threadId",
    params: { threadId: nextThreadId },
  });
}

export function useChatPullRequestController(
  options: UseChatPullRequestControllerOptions,
): UseChatPullRequestControllerResult {
  const {
    activeProject,
    canCheckoutPullRequestIntoThread,
    currentThreadId,
    getDraftThreadByProjectId,
    getDraftThread,
    setDraftThreadContext,
    setProjectDraftThreadId,
    clearProjectDraftThreadId,
    navigate,
    clearComposerHighlightedItemId,
    isServerThread,
  } = options;
  const [pullRequestDialogState, setPullRequestDialogState] =
    useState<PullRequestDialogState | null>(null);

  useEffect(() => {
    setPullRequestDialogState(null);
  }, [currentThreadId]);

  const openPullRequestDialog = useCallback(
    (reference?: string) => {
      if (!canCheckoutPullRequestIntoThread) {
        return;
      }
      setPullRequestDialogState({
        initialReference: reference ?? null,
        key: Date.now(),
      });
      clearComposerHighlightedItemId();
    },
    [canCheckoutPullRequestIntoThread, clearComposerHighlightedItemId],
  );

  const closePullRequestDialog = useCallback(() => {
    setPullRequestDialogState(null);
  }, []);

  const handlePreparedPullRequestThread = useCallback(
    async (input: { branch: string; worktreePath: string | null }) => {
      await openOrReuseProjectDraftThread({
        activeProject,
        canCheckoutPullRequestIntoThread,
        currentThreadId,
        getDraftThreadByProjectId,
        getDraftThread,
        setDraftThreadContext,
        setProjectDraftThreadId,
        clearProjectDraftThreadId,
        navigate,
        clearComposerHighlightedItemId,
        isServerThread,
        draftThreadInput: {
          branch: input.branch,
          worktreePath: input.worktreePath,
          envMode: input.worktreePath ? "worktree" : "local",
        },
      });
    },
    [
      activeProject,
      canCheckoutPullRequestIntoThread,
      clearComposerHighlightedItemId,
      clearProjectDraftThreadId,
      currentThreadId,
      getDraftThread,
      getDraftThreadByProjectId,
      isServerThread,
      navigate,
      setDraftThreadContext,
      setProjectDraftThreadId,
    ],
  );

  return {
    pullRequestDialogState,
    openPullRequestDialog,
    closePullRequestDialog,
    handlePreparedPullRequestThread,
  };
}
