import { type ThreadId } from "@t3tools/contracts";
import { useCallback } from "react";

import { newCommandId } from "../../lib/utils";
import { readNativeApi } from "../../nativeApi";
import type { Thread, ThreadPrimarySurface } from "../../types";
import {
  confirmTerminalTabClose,
  resolveTerminalCloseTitle,
} from "../../lib/terminalCloseConfirmation";
import { shouldAutoDeleteTerminalThreadOnLastClose } from "../ChatView.logic";
import { useComposerDraftStore } from "../../composerDraftStore";

interface TerminalActionState {
  activeTerminalId: string;
  entryPoint: ThreadPrimarySurface;
  terminalIds: string[];
  terminalLabelsById: Record<string, string>;
  terminalOpen: boolean;
  terminalTitleOverridesById: Record<string, string>;
  workspaceActiveTab: "terminal" | "chat";
  workspaceLayout: "both" | "terminal-only";
}

interface UseChatTerminalActionBindingsOptions {
  activeThread: Thread | undefined;
  activeThreadId: ThreadId | null;
  activeSplitViewId: string | null;
  closeTerminalState: (terminalId: string) => void;
  clearTerminalState: () => void;
  closeWorkspaceChat: () => void;
  confirmTerminalTabCloseEnabled: boolean;
  isServerThread: boolean;
  removeThreadFromSplitViews: (threadId: ThreadId) => void;
  resolveNextSplitViewThread: (
    splitViewId: string,
  ) => { splitViewId: string; threadId: ThreadId } | null;
  setTerminalOpen: (open: boolean) => void;
  setTerminalPresentationMode: (mode: "drawer" | "workspace") => void;
  setTerminalWorkspaceLayout: (layout: "both" | "terminal-only") => void;
  setTerminalWorkspaceTab: (tab: "terminal" | "chat") => void;
  syncServerReadModel: (
    snapshot: Awaited<
      ReturnType<NonNullable<ReturnType<typeof readNativeApi>>["orchestration"]["getSnapshot"]>
    >,
  ) => void;
  terminalState: TerminalActionState;
  terminalWorkspaceOpen: boolean;
  navigateHome: () => Promise<void>;
  navigateToThread: (threadId: ThreadId, splitViewId: string) => Promise<void>;
}

interface UseChatTerminalActionBindingsResult {
  collapseTerminalWorkspace: () => void;
  closeActiveWorkspaceView: () => void;
  closeTerminal: (terminalId: string) => Promise<void>;
  expandTerminalWorkspace: () => void;
  toggleTerminalVisibility: () => void;
}

// Owns the terminal drawer/workspace visibility and close/delete flow so ChatView only wires the UI callbacks.
export function useChatTerminalActionBindings(
  options: UseChatTerminalActionBindingsOptions,
): UseChatTerminalActionBindingsResult {
  const {
    activeThread,
    activeThreadId,
    activeSplitViewId,
    closeTerminalState,
    clearTerminalState,
    closeWorkspaceChat,
    confirmTerminalTabCloseEnabled,
    isServerThread,
    navigateHome,
    navigateToThread,
    removeThreadFromSplitViews,
    resolveNextSplitViewThread,
    setTerminalOpen,
    setTerminalPresentationMode,
    setTerminalWorkspaceLayout,
    setTerminalWorkspaceTab,
    syncServerReadModel,
    terminalState,
    terminalWorkspaceOpen,
  } = options;

  const toggleTerminalVisibility = useCallback(() => {
    if (!activeThreadId) return;
    if (!terminalState.terminalOpen) {
      setTerminalPresentationMode("drawer");
    }
    setTerminalOpen(!terminalState.terminalOpen);
  }, [activeThreadId, setTerminalOpen, setTerminalPresentationMode, terminalState.terminalOpen]);

  const expandTerminalWorkspace = useCallback(() => {
    if (!activeThreadId) return;
    setTerminalPresentationMode("workspace");
    setTerminalWorkspaceLayout("both");
    setTerminalWorkspaceTab("terminal");
  }, [
    activeThreadId,
    setTerminalPresentationMode,
    setTerminalWorkspaceLayout,
    setTerminalWorkspaceTab,
  ]);

  const collapseTerminalWorkspace = useCallback(() => {
    if (!activeThreadId) return;
    setTerminalPresentationMode("drawer");
  }, [activeThreadId, setTerminalPresentationMode]);

  const closeTerminal = useCallback(
    async (terminalId: string) => {
      const api = readNativeApi();
      if (!activeThreadId || !api) return;

      const isFinalTerminal = terminalState.terminalIds.length <= 1;
      const shouldDeletePlaceholderTerminalThread = shouldAutoDeleteTerminalThreadOnLastClose({
        isLastTerminal: isFinalTerminal,
        isServerThread,
        terminalEntryPoint: terminalState.entryPoint,
        thread: activeThread,
      });
      const confirmed = await confirmTerminalTabClose({
        api,
        enabled: confirmTerminalTabCloseEnabled,
        terminalTitle: resolveTerminalCloseTitle({
          terminalId,
          terminalLabelsById: terminalState.terminalLabelsById,
          terminalTitleOverridesById: terminalState.terminalTitleOverridesById,
        }),
        willDeleteThread: shouldDeletePlaceholderTerminalThread,
      });
      if (!confirmed) {
        return;
      }

      const fallbackExitWrite = () =>
        api.terminal
          .write({ threadId: activeThreadId, terminalId, data: "exit\n" })
          .catch(() => undefined);
      if ("close" in api.terminal && typeof api.terminal.close === "function") {
        void (async () => {
          if (isFinalTerminal) {
            await api.terminal
              .clear({ threadId: activeThreadId, terminalId })
              .catch(() => undefined);
          }
          await api.terminal.close({
            threadId: activeThreadId,
            terminalId,
            deleteHistory: true,
          });
        })().catch(() => fallbackExitWrite());
      } else {
        void fallbackExitWrite();
      }

      closeTerminalState(terminalId);
      if (!shouldDeletePlaceholderTerminalThread) {
        return;
      }

      void (async () => {
        try {
          await api.orchestration.dispatchCommand({
            type: "thread.delete",
            commandId: newCommandId(),
            threadId: activeThreadId,
          });
          const snapshot = await api.orchestration.getSnapshot();
          syncServerReadModel(snapshot);
          useComposerDraftStore.getState().clearDraftThread(activeThreadId);
          clearTerminalState();
          removeThreadFromSplitViews(activeThreadId);

          if (activeSplitViewId) {
            const nextSplitView = resolveNextSplitViewThread(activeSplitViewId);
            if (nextSplitView) {
              await navigateToThread(nextSplitView.threadId, nextSplitView.splitViewId);
              return;
            }
          }

          await navigateHome();
        } catch (error) {
          console.error("Failed to delete empty terminal thread after closing its last terminal", {
            threadId: activeThreadId,
            error,
          });
        }
      })();
    },
    [
      activeSplitViewId,
      activeThread,
      activeThreadId,
      clearTerminalState,
      closeTerminalState,
      confirmTerminalTabCloseEnabled,
      isServerThread,
      navigateHome,
      navigateToThread,
      removeThreadFromSplitViews,
      resolveNextSplitViewThread,
      syncServerReadModel,
      terminalState.entryPoint,
      terminalState.terminalIds.length,
      terminalState.terminalLabelsById,
      terminalState.terminalTitleOverridesById,
    ],
  );

  const closeActiveWorkspaceView = useCallback(() => {
    if (!activeThreadId || !terminalWorkspaceOpen) {
      return;
    }
    if (terminalState.workspaceLayout === "both" && terminalState.workspaceActiveTab === "chat") {
      closeWorkspaceChat();
      return;
    }
    void closeTerminal(terminalState.activeTerminalId);
  }, [
    activeThreadId,
    closeTerminal,
    closeWorkspaceChat,
    terminalState.activeTerminalId,
    terminalState.workspaceActiveTab,
    terminalState.workspaceLayout,
    terminalWorkspaceOpen,
  ]);

  return {
    collapseTerminalWorkspace,
    closeActiveWorkspaceView,
    closeTerminal,
    expandTerminalWorkspace,
    toggleTerminalVisibility,
  };
}
