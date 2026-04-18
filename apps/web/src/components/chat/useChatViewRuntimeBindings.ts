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
  const [expandedWorkGroups, setExpandedWorkGroups] = useState<Record<string, boolean>>({});
  const [isComposerFooterCompact, setIsComposerFooterCompact] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const composerFormHeightRef = useRef(0);

  const stopActiveThreadSession = useCallback(async () => {
    const api = readNativeApi();
    if (
      !api ||
      !options.isServerThread ||
      !options.activeThread ||
      options.activeThread.session === null ||
      options.activeThread.session.status === "closed"
    ) {
      return;
    }

    await api.orchestration.dispatchCommand({
      type: "thread.session.stop",
      commandId: newCommandId(),
      threadId: options.activeThread.id,
      createdAt: new Date().toISOString(),
    });
  }, [options.activeThread, options.isServerThread]);

  const handoffBindings = useThreadWorkspaceHandoff({
    activeProject: options.activeProject,
    activeThread: options.activeThread,
    activeRootBranch: options.activeRootBranch,
    activeThreadAssociatedWorktree: options.activeThreadAssociatedWorktree,
    isServerThread: options.isServerThread,
    stopActiveThreadSession,
    runProjectScript: options.runProjectScript,
    setStoreThreadWorkspace: options.setStoreThreadWorkspace,
    syncServerReadModel: options.syncServerReadModel,
  });

  const autoScrollBindings = useChatAutoScrollController({
    threadId: options.activeThread?.id ?? null,
    isStreaming: options.isWorking,
    messageCount: options.messageCount,
  });

  useLayoutEffect(() => {
    const composerForm = options.composerFormRef.current;
    if (!composerForm) {
      return;
    }

    const measureComposerFormWidth = () => composerForm.clientWidth;

    composerFormHeightRef.current = composerForm.getBoundingClientRect().height;
    setIsComposerFooterCompact(
      shouldUseCompactComposerFooter(measureComposerFormWidth(), {
        hasWideActions: options.composerFooterHasWideActions,
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
        hasWideActions: options.composerFooterHasWideActions,
      });
      setIsComposerFooterCompact((previous) => (previous === nextCompact ? previous : nextCompact));

      const nextHeight = entry.contentRect.height;
      const previousHeight = composerFormHeightRef.current;
      composerFormHeightRef.current = nextHeight;

      autoScrollBindings.onComposerHeightChange(previousHeight, nextHeight);
    });

    observer.observe(composerForm);
    return () => {
      observer.disconnect();
    };
  }, [
    options.activeThread?.id,
    options.composerFooterHasWideActions,
    options.composerFormRef,
    autoScrollBindings.onComposerHeightChange,
  ]);

  useEffect(() => {
    setExpandedWorkGroups({});
  }, [options.activeThread?.id]);

  useEffect(() => {
    options.setIsRevertingCheckpoint(false);
  }, [options.activeThread?.id, options.setIsRevertingCheckpoint]);

  useEffect(() => {
    if (!options.activeThread?.id || options.terminalOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      options.focusComposer();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [options.activeThread?.id, options.focusComposer, options.terminalOpen]);

  useEffect(() => {
    options.composerImagesRef.current = options.composerImages;
  }, [options.composerImages, options.composerImagesRef]);

  useEffect(() => {
    options.composerTerminalContextsRef.current = options.composerTerminalContexts;
  }, [options.composerTerminalContexts, options.composerTerminalContextsRef]);

  useEffect(() => {
    options.queuedComposerTurnsRef.current = options.queuedComposerTurns;
  }, [options.queuedComposerTurns, options.queuedComposerTurnsRef]);

  useEffect(() => {
    options.autoDispatchingQueuedTurnRef.current = false;
  }, [options.autoDispatchingQueuedTurnRef, options.activeThread?.id]);

  useEffect(() => {
    options.promptRef.current = options.prompt;
    options.composerCursorSetter((existing) =>
      clampCollapsedComposerCursor(options.prompt, existing),
    );
  }, [options.composerCursorSetter, options.prompt, options.promptRef]);

  const envMode: DraftThreadEnvMode = options.isServerThread
    ? resolveThreadEnvironmentMode({
        envMode: options.activeThread?.envMode,
        worktreePath: options.activeThread?.worktreePath ?? null,
      })
    : (options.draftThreadEnvMode ?? "local");

  const envState = resolveThreadWorkspaceState({
    envMode: options.resolvedThreadEnvMode,
    worktreePath: options.resolvedThreadWorktreePath,
  });

  useEffect(() => {
    if (!options.isWorking) {
      return;
    }

    setNowTick(Date.now());
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [options.isWorking]);

  const onRevertToTurnCount = useCallback(
    async (turnCount: number) => {
      const api = readNativeApi();
      if (!api || !options.activeThread || options.isRevertingCheckpoint) {
        return;
      }

      if (options.hasLiveTurn || options.isSendBusy || options.isConnecting) {
        options.setThreadError(
          options.activeThread.id,
          "Interrupt the current turn before reverting checkpoints.",
        );
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

      options.setIsRevertingCheckpoint(true);
      options.setThreadError(options.activeThread.id, null);
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.checkpoint.revert",
          commandId: newCommandId(),
          threadId: options.activeThread.id,
          turnCount,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        options.setThreadError(
          options.activeThread.id,
          err instanceof Error ? err.message : "Failed to revert thread state.",
        );
      }
      options.setIsRevertingCheckpoint(false);
    },
    [
      options.activeThread,
      options.hasLiveTurn,
      options.isConnecting,
      options.isRevertingCheckpoint,
      options.isSendBusy,
      options.setIsRevertingCheckpoint,
      options.setThreadError,
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
