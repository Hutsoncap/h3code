// FILE: useChatViewRuntimeBindings.ts
// Purpose: Own ChatView's remaining runtime/view lifecycle wiring and runtime-derived callbacks.
// Layer: ChatView hook
// Depends on: caller-owned thread/composer/terminal state and previously extracted action hooks.

import { type ThreadId } from "@t3tools/contracts";
import {
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { clampCollapsedComposerCursor } from "../../composer-logic";
import type {
  ComposerImageAttachment,
  DraftThreadEnvMode,
  QueuedComposerTurn,
} from "../../composerDraftStore";
import { useThreadWorkspaceHandoff } from "../../hooks/useThreadWorkspaceHandoff";
import type { TerminalContextDraft } from "../../lib/terminalContext";
import {
  resolveThreadEnvironmentMode,
  resolveThreadWorkspaceState,
} from "../../lib/threadEnvironment";
import { newCommandId } from "../../lib/utils";
import { readNativeApi } from "../../nativeApi";
import { shouldUseCompactComposerFooter } from "../composerFooterLayout";
import { useChatAutoScrollController } from "./useChatAutoScrollController";

interface UseChatViewRuntimeBindingsOptions {
  activeProject: Parameters<typeof useThreadWorkspaceHandoff>[0]["activeProject"];
  activeRootBranch: Parameters<typeof useThreadWorkspaceHandoff>[0]["activeRootBranch"];
  activeThread: Parameters<typeof useThreadWorkspaceHandoff>[0]["activeThread"];
  activeThreadAssociatedWorktree: Parameters<
    typeof useThreadWorkspaceHandoff
  >[0]["activeThreadAssociatedWorktree"];
  autoDispatchingQueuedTurnRef: MutableRefObject<boolean>;
  composerCursorSetter: Dispatch<SetStateAction<number>>;
  composerFooterHasWideActions: boolean;
  composerFormRef: RefObject<HTMLFormElement | null>;
  composerImages: ComposerImageAttachment[];
  composerImagesRef: MutableRefObject<ComposerImageAttachment[]>;
  composerTerminalContexts: TerminalContextDraft[];
  composerTerminalContextsRef: MutableRefObject<TerminalContextDraft[]>;
  draftThreadEnvMode: DraftThreadEnvMode | null;
  focusComposer: () => void;
  hasLiveTurn: boolean;
  isConnecting: boolean;
  isRevertingCheckpoint: boolean;
  isSendBusy: boolean;
  isServerThread: Parameters<typeof useThreadWorkspaceHandoff>[0]["isServerThread"];
  isWorking: boolean;
  messageCount: number;
  prompt: string;
  promptRef: MutableRefObject<string>;
  queuedComposerTurns: QueuedComposerTurn[];
  queuedComposerTurnsRef: MutableRefObject<QueuedComposerTurn[]>;
  resolvedThreadEnvMode: DraftThreadEnvMode | null;
  resolvedThreadWorktreePath: string | null;
  runProjectScript: Parameters<typeof useThreadWorkspaceHandoff>[0]["runProjectScript"];
  setIsRevertingCheckpoint: Dispatch<SetStateAction<boolean>>;
  setStoreThreadWorkspace: Parameters<
    typeof useThreadWorkspaceHandoff
  >[0]["setStoreThreadWorkspace"];
  setThreadError: (threadId: ThreadId, error: string | null) => void;
  syncServerReadModel: Parameters<typeof useThreadWorkspaceHandoff>[0]["syncServerReadModel"];
  terminalOpen: boolean;
}

export function useChatViewRuntimeBindings(options: UseChatViewRuntimeBindingsOptions) {
  const {
    activeProject,
    activeRootBranch,
    activeThread,
    activeThreadAssociatedWorktree,
    autoDispatchingQueuedTurnRef,
    composerCursorSetter,
    composerFooterHasWideActions,
    composerFormRef,
    composerImages,
    composerImagesRef,
    composerTerminalContexts,
    composerTerminalContextsRef,
    draftThreadEnvMode,
    focusComposer,
    hasLiveTurn,
    isConnecting,
    isRevertingCheckpoint,
    isSendBusy,
    isServerThread,
    isWorking,
    messageCount,
    prompt,
    promptRef,
    queuedComposerTurns,
    queuedComposerTurnsRef,
    resolvedThreadEnvMode,
    resolvedThreadWorktreePath,
    runProjectScript,
    setIsRevertingCheckpoint,
    setStoreThreadWorkspace,
    setThreadError,
    syncServerReadModel,
    terminalOpen,
  } = options;
  const [expandedWorkGroups, setExpandedWorkGroups] = useState<Record<string, boolean>>({});
  const [isComposerFooterCompact, setIsComposerFooterCompact] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const composerFormHeightRef = useRef(0);

  const stopActiveThreadSession = useCallback(async () => {
    const api = readNativeApi();
    if (
      !api ||
      !isServerThread ||
      !activeThread ||
      activeThread.session === null ||
      activeThread.session.status === "closed"
    ) {
      return;
    }

    await api.orchestration.dispatchCommand({
      type: "thread.session.stop",
      commandId: newCommandId(),
      threadId: activeThread.id,
      createdAt: new Date().toISOString(),
    });
  }, [activeThread, isServerThread]);

  const handoffBindings = useThreadWorkspaceHandoff({
    activeProject,
    activeThread,
    activeRootBranch,
    activeThreadAssociatedWorktree,
    isServerThread,
    stopActiveThreadSession,
    runProjectScript,
    setStoreThreadWorkspace,
    syncServerReadModel,
  });

  const { onComposerHeightChange, ...autoScrollBindings } = useChatAutoScrollController({
    threadId: activeThread?.id ?? null,
    isStreaming: isWorking,
    messageCount,
  });

  useLayoutEffect(() => {
    const composerForm = composerFormRef.current;
    if (!composerForm) {
      return;
    }

    const measureComposerFormWidth = () => composerForm.clientWidth;

    composerFormHeightRef.current = composerForm.getBoundingClientRect().height;
    setIsComposerFooterCompact(
      shouldUseCompactComposerFooter(measureComposerFormWidth(), {
        hasWideActions: composerFooterHasWideActions,
      }),
    );
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) {
        return;
      }

      const nextCompact = shouldUseCompactComposerFooter(measureComposerFormWidth(), {
        hasWideActions: composerFooterHasWideActions,
      });
      setIsComposerFooterCompact((previous) => (previous === nextCompact ? previous : nextCompact));

      const nextHeight = entry.contentRect.height;
      const previousHeight = composerFormHeightRef.current;
      composerFormHeightRef.current = nextHeight;

      onComposerHeightChange(previousHeight, nextHeight);
    });

    observer.observe(composerForm);
    return () => {
      observer.disconnect();
    };
  }, [activeThread?.id, composerFooterHasWideActions, composerFormRef, onComposerHeightChange]);

  useEffect(() => {
    setExpandedWorkGroups({});
  }, [activeThread?.id]);

  useEffect(() => {
    setIsRevertingCheckpoint(false);
  }, [activeThread?.id, setIsRevertingCheckpoint]);

  useEffect(() => {
    if (!activeThread?.id || terminalOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      focusComposer();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeThread?.id, focusComposer, terminalOpen]);

  useEffect(() => {
    composerImagesRef.current = composerImages;
  }, [composerImages, composerImagesRef]);

  useEffect(() => {
    composerTerminalContextsRef.current = composerTerminalContexts;
  }, [composerTerminalContexts, composerTerminalContextsRef]);

  useEffect(() => {
    queuedComposerTurnsRef.current = queuedComposerTurns;
  }, [queuedComposerTurns, queuedComposerTurnsRef]);

  useEffect(() => {
    autoDispatchingQueuedTurnRef.current = false;
  }, [autoDispatchingQueuedTurnRef, activeThread?.id]);

  useEffect(() => {
    promptRef.current = prompt;
    composerCursorSetter((existing) => clampCollapsedComposerCursor(prompt, existing));
  }, [composerCursorSetter, prompt, promptRef]);

  const envMode: DraftThreadEnvMode = isServerThread
    ? resolveThreadEnvironmentMode({
        envMode: activeThread?.envMode,
        worktreePath: activeThread?.worktreePath ?? null,
      })
    : (draftThreadEnvMode ?? "local");

  const envState = resolveThreadWorkspaceState({
    envMode: resolvedThreadEnvMode,
    worktreePath: resolvedThreadWorktreePath,
  });

  useEffect(() => {
    if (!isWorking) {
      return;
    }

    setNowTick(Date.now());
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [isWorking]);

  const onRevertToTurnCount = useCallback(
    async (turnCount: number) => {
      const api = readNativeApi();
      if (!api || !activeThread || isRevertingCheckpoint) {
        return;
      }

      if (hasLiveTurn || isSendBusy || isConnecting) {
        setThreadError(activeThread.id, "Interrupt the current turn before reverting checkpoints.");
        return;
      }

      const confirmed = await api.dialogs.confirm(
        [
          `Revert this thread to checkpoint ${turnCount}?`,
          "This will discard newer messages and turn diffs in this thread.",
          "This action cannot be undone.",
        ].join("\n"),
      );
      if (!confirmed) {
        return;
      }

      setIsRevertingCheckpoint(true);
      setThreadError(activeThread.id, null);
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.checkpoint.revert",
          commandId: newCommandId(),
          threadId: activeThread.id,
          turnCount,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        setThreadError(
          activeThread.id,
          err instanceof Error ? err.message : "Failed to revert thread state.",
        );
      }
      setIsRevertingCheckpoint(false);
    },
    [
      activeThread,
      hasLiveTurn,
      isConnecting,
      isRevertingCheckpoint,
      isSendBusy,
      setIsRevertingCheckpoint,
      setThreadError,
    ],
  );

  return {
    ...autoScrollBindings,
    ...handoffBindings,
    expandedWorkGroups,
    envMode,
    envState,
    isComposerFooterCompact,
    nowIso: new Date(nowTick).toISOString(),
    onRevertToTurnCount,
    setExpandedWorkGroups,
  };
}
