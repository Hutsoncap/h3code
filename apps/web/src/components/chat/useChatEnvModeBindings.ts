// FILE: useChatEnvModeBindings.ts
// Purpose: Own ChatView's environment-mode updates for draft threads and eligible server threads.
// Layer: ChatView hook
// Depends on: Native orchestration commands plus caller-owned draft-thread state updates.

import { ThreadId } from "@t3tools/contracts";
import { useCallback } from "react";

import type { DraftThreadEnvMode } from "../../composerDraftStore";
import { readNativeApi } from "../../nativeApi";
import { newCommandId } from "../../lib/utils";
import type { Thread } from "../../types";

interface DraftThreadBranchContext {
  branch?: string | null;
}

interface UseChatEnvModeBindingsOptions {
  threadId: ThreadId;
  activeThread: Thread | undefined;
  draftThreadBranch: string | null;
  activeRootBranch: string | null;
  hasNativeUserMessages: boolean;
  isLocalDraftThread: boolean;
  isServerThread: boolean;
  scheduleComposerFocus: () => void;
  setDraftThreadContext: (
    threadId: ThreadId,
    context: { envMode: DraftThreadEnvMode } & DraftThreadBranchContext,
  ) => void;
}

interface UseChatEnvModeBindingsResult {
  onEnvModeChange: (mode: DraftThreadEnvMode) => void;
}

// Keeps environment-mode mutation rules together so ChatView can wire the branch toolbar without owning the update details.
export function useChatEnvModeBindings(
  options: UseChatEnvModeBindingsOptions,
): UseChatEnvModeBindingsResult {
  const {
    threadId,
    activeThread,
    draftThreadBranch,
    activeRootBranch,
    hasNativeUserMessages,
    isLocalDraftThread,
    isServerThread,
    scheduleComposerFocus,
    setDraftThreadContext,
  } = options;

  const onEnvModeChange = useCallback(
    (mode: DraftThreadEnvMode) => {
      const nextBranch =
        mode === "worktree"
          ? (activeThread?.branch ?? draftThreadBranch ?? activeRootBranch ?? null)
          : (activeThread?.branch ?? draftThreadBranch ?? null);
      if (isLocalDraftThread) {
        setDraftThreadContext(threadId, {
          envMode: mode,
          ...(nextBranch ? { branch: nextBranch } : {}),
        });
      }
      if (isServerThread && activeThread && !hasNativeUserMessages && !activeThread.session) {
        const api = readNativeApi();
        if (api) {
          void api.orchestration.dispatchCommand({
            type: "thread.meta.update",
            commandId: newCommandId(),
            threadId,
            envMode: mode,
            ...(nextBranch ? { branch: nextBranch } : {}),
            ...(mode === "local" ? { worktreePath: null } : {}),
          });
        }
      }
      scheduleComposerFocus();
    },
    [
      activeThread,
      activeRootBranch,
      draftThreadBranch,
      hasNativeUserMessages,
      isLocalDraftThread,
      isServerThread,
      scheduleComposerFocus,
      setDraftThreadContext,
      threadId,
    ],
  );

  return { onEnvModeChange };
}
