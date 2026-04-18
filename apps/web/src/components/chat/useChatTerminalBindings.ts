import { type ThreadId } from "@t3tools/contracts";
import { useCallback, useMemo, useState } from "react";

import { resolveTerminalNewAction } from "../../lib/terminalNewAction";
import { randomUUID } from "../../lib/utils";
import { collectTerminalIdsFromLayout } from "../../terminalPaneLayout";
import { selectThreadTerminalState, useTerminalStateStore } from "../../terminalStateStore";
import { MAX_TERMINALS_PER_GROUP } from "../../types";
import { shouldRenderTerminalWorkspace } from "../ChatView.logic";

function createTerminalId(): string {
  return `terminal-${randomUUID()}`;
}

interface ChatTerminalMetadata {
  cliKind: "codex" | "claude" | null;
  label: string;
}

interface ChatTerminalActivity {
  hasRunningSubprocess: boolean;
  agentState: "running" | "attention" | "review" | null;
}

type ChatTerminalState = ReturnType<typeof selectThreadTerminalState>;

export interface ChatTerminalBindings {
  terminalState: ChatTerminalState;
  terminalFocusRequestId: number;
  requestTerminalFocus: () => void;
  terminalWorkspaceOpen: boolean;
  terminalWorkspaceTerminalTabActive: boolean;
  terminalWorkspaceChatTabActive: boolean;
  openTerminalThreadPage: (options?: { terminalOnly?: boolean }) => void;
  setTerminalOpen: (open: boolean) => void;
  setTerminalPresentationMode: (mode: "drawer" | "workspace") => void;
  setTerminalWorkspaceLayout: (layout: "both" | "terminal-only") => void;
  setTerminalWorkspaceTab: (tab: "terminal" | "chat") => void;
  setTerminalHeight: (height: number) => void;
  setTerminalMetadata: (terminalId: string, metadata: ChatTerminalMetadata) => void;
  setTerminalActivity: (terminalId: string, activity: ChatTerminalActivity) => void;
  splitTerminalRight: () => void;
  splitTerminalLeft: () => void;
  splitTerminalDown: () => void;
  splitTerminalUp: () => void;
  createNewTerminal: () => void;
  createNewTerminalTab: (targetTerminalId: string) => void;
  createTerminalFromShortcut: () => void;
  moveTerminalToNewGroup: (terminalId: string) => void;
  openNewFullWidthTerminal: () => void;
  closeWorkspaceChat: () => void;
  activateTerminal: (terminalId: string) => void;
  closeTerminal: (terminalId: string) => void;
  closeTerminalGroup: (groupId: string) => void;
  resizeTerminalSplit: (groupId: string, splitId: string, weights: number[]) => void;
  clearTerminalState: () => void;
}

export function useChatTerminalBindings(input: {
  threadId: ThreadId;
  activeThreadId: ThreadId | null;
  activeProjectExists: boolean;
}): ChatTerminalBindings {
  const { threadId, activeThreadId, activeProjectExists } = input;

  const terminalState = useTerminalStateStore((state) =>
    selectThreadTerminalState(state.terminalStateByThreadId, threadId),
  );
  const storeSetTerminalOpen = useTerminalStateStore((state) => state.setTerminalOpen);
  const storeSetTerminalPresentationMode = useTerminalStateStore(
    (state) => state.setTerminalPresentationMode,
  );
  const storeSetTerminalWorkspaceLayout = useTerminalStateStore(
    (state) => state.setTerminalWorkspaceLayout,
  );
  const storeOpenTerminalThreadPage = useTerminalStateStore(
    (state) => state.openTerminalThreadPage,
  );
  const storeSetTerminalWorkspaceTab = useTerminalStateStore(
    (state) => state.setTerminalWorkspaceTab,
  );
  const storeSetTerminalHeight = useTerminalStateStore((state) => state.setTerminalHeight);
  const storeSetTerminalMetadata = useTerminalStateStore((state) => state.setTerminalMetadata);
  const storeSetTerminalActivity = useTerminalStateStore((state) => state.setTerminalActivity);
  const storeSplitTerminalLeft = useTerminalStateStore((state) => state.splitTerminalLeft);
  const storeSplitTerminalRight = useTerminalStateStore((state) => state.splitTerminalRight);
  const storeSplitTerminalDown = useTerminalStateStore((state) => state.splitTerminalDown);
  const storeSplitTerminalUp = useTerminalStateStore((state) => state.splitTerminalUp);
  const storeNewTerminal = useTerminalStateStore((state) => state.newTerminal);
  const storeNewTerminalTab = useTerminalStateStore((state) => state.newTerminalTab);
  const storeOpenNewFullWidthTerminal = useTerminalStateStore(
    (state) => state.openNewFullWidthTerminal,
  );
  const storeCloseWorkspaceChat = useTerminalStateStore((state) => state.closeWorkspaceChat);
  const storeSetActiveTerminal = useTerminalStateStore((state) => state.setActiveTerminal);
  const storeCloseTerminal = useTerminalStateStore((state) => state.closeTerminal);
  const storeCloseTerminalGroup = useTerminalStateStore((state) => state.closeTerminalGroup);
  const storeResizeTerminalSplit = useTerminalStateStore((state) => state.resizeTerminalSplit);
  const storeClearTerminalState = useTerminalStateStore((state) => state.clearTerminalState);

  const [terminalFocusRequestId, setTerminalFocusRequestId] = useState(0);

  const requestTerminalFocus = useCallback(() => {
    setTerminalFocusRequestId((value) => value + 1);
  }, []);

  const activeTerminalGroup = useMemo(
    () =>
      terminalState.terminalGroups.find(
        (group) => group.id === terminalState.activeTerminalGroupId,
      ) ??
      terminalState.terminalGroups.find((group) =>
        collectTerminalIdsFromLayout(group.layout).includes(terminalState.activeTerminalId),
      ) ??
      null,
    [
      terminalState.activeTerminalGroupId,
      terminalState.activeTerminalId,
      terminalState.terminalGroups,
    ],
  );

  const hasReachedSplitLimit = useMemo(
    () =>
      (activeTerminalGroup ? collectTerminalIdsFromLayout(activeTerminalGroup.layout).length : 0) >=
      MAX_TERMINALS_PER_GROUP,
    [activeTerminalGroup],
  );

  const terminalWorkspaceOpen = useMemo(
    () =>
      shouldRenderTerminalWorkspace({
        activeProjectExists,
        presentationMode: terminalState.presentationMode,
        terminalOpen: terminalState.terminalOpen,
      }),
    [activeProjectExists, terminalState.presentationMode, terminalState.terminalOpen],
  );

  const terminalWorkspaceTerminalTabActive =
    terminalWorkspaceOpen &&
    (terminalState.workspaceLayout === "terminal-only" ||
      terminalState.workspaceActiveTab === "terminal");
  const terminalWorkspaceChatTabActive =
    terminalWorkspaceOpen &&
    terminalState.workspaceLayout === "both" &&
    terminalState.workspaceActiveTab === "chat";

  const openTerminalThreadPage = useCallback(
    (options?: { terminalOnly?: boolean }) => {
      if (!activeThreadId) return;
      storeOpenTerminalThreadPage(activeThreadId, options);
    },
    [activeThreadId, storeOpenTerminalThreadPage],
  );

  const setTerminalOpen = useCallback(
    (open: boolean) => {
      if (!activeThreadId) return;
      storeSetTerminalOpen(activeThreadId, open);
    },
    [activeThreadId, storeSetTerminalOpen],
  );

  const setTerminalPresentationMode = useCallback(
    (mode: "drawer" | "workspace") => {
      if (!activeThreadId) return;
      storeSetTerminalPresentationMode(activeThreadId, mode);
    },
    [activeThreadId, storeSetTerminalPresentationMode],
  );

  const setTerminalWorkspaceLayout = useCallback(
    (layout: "both" | "terminal-only") => {
      if (!activeThreadId) return;
      storeSetTerminalWorkspaceLayout(activeThreadId, layout);
    },
    [activeThreadId, storeSetTerminalWorkspaceLayout],
  );

  const setTerminalWorkspaceTab = useCallback(
    (tab: "terminal" | "chat") => {
      if (!activeThreadId) return;
      storeSetTerminalWorkspaceTab(activeThreadId, tab);
    },
    [activeThreadId, storeSetTerminalWorkspaceTab],
  );

  const setTerminalHeight = useCallback(
    (height: number) => {
      if (!activeThreadId) return;
      storeSetTerminalHeight(activeThreadId, height);
    },
    [activeThreadId, storeSetTerminalHeight],
  );

  const setTerminalMetadata = useCallback(
    (terminalId: string, metadata: ChatTerminalMetadata) => {
      if (!activeThreadId) return;
      storeSetTerminalMetadata(activeThreadId, terminalId, metadata);
    },
    [activeThreadId, storeSetTerminalMetadata],
  );

  const setTerminalActivity = useCallback(
    (terminalId: string, activity: ChatTerminalActivity) => {
      if (!activeThreadId) return;
      storeSetTerminalActivity(activeThreadId, terminalId, activity);
    },
    [activeThreadId, storeSetTerminalActivity],
  );

  const splitTerminalRight = useCallback(() => {
    if (!activeThreadId || hasReachedSplitLimit) return;
    storeSplitTerminalRight(activeThreadId, createTerminalId());
    requestTerminalFocus();
  }, [activeThreadId, hasReachedSplitLimit, requestTerminalFocus, storeSplitTerminalRight]);

  const splitTerminalLeft = useCallback(() => {
    if (!activeThreadId || hasReachedSplitLimit) return;
    storeSplitTerminalLeft(activeThreadId, createTerminalId());
    requestTerminalFocus();
  }, [activeThreadId, hasReachedSplitLimit, requestTerminalFocus, storeSplitTerminalLeft]);

  const splitTerminalDown = useCallback(() => {
    if (!activeThreadId || hasReachedSplitLimit) return;
    storeSplitTerminalDown(activeThreadId, createTerminalId());
    requestTerminalFocus();
  }, [activeThreadId, hasReachedSplitLimit, requestTerminalFocus, storeSplitTerminalDown]);

  const splitTerminalUp = useCallback(() => {
    if (!activeThreadId || hasReachedSplitLimit) return;
    storeSplitTerminalUp(activeThreadId, createTerminalId());
    requestTerminalFocus();
  }, [activeThreadId, hasReachedSplitLimit, requestTerminalFocus, storeSplitTerminalUp]);

  const createNewTerminal = useCallback(() => {
    if (!activeThreadId) return;
    storeNewTerminal(activeThreadId, createTerminalId());
    requestTerminalFocus();
  }, [activeThreadId, requestTerminalFocus, storeNewTerminal]);

  const createNewTerminalTab = useCallback(
    (targetTerminalId: string) => {
      if (!activeThreadId) return;
      storeNewTerminalTab(activeThreadId, targetTerminalId, createTerminalId());
      requestTerminalFocus();
    },
    [activeThreadId, requestTerminalFocus, storeNewTerminalTab],
  );

  const createTerminalFromShortcut = useCallback(() => {
    const action = resolveTerminalNewAction({
      terminalOpen: terminalState.terminalOpen,
      activeTerminalId: terminalState.activeTerminalId,
      activeTerminalGroupId: terminalState.activeTerminalGroupId,
      terminalGroups: terminalState.terminalGroups,
    });

    if (action.kind === "new-group") {
      if (!terminalState.terminalOpen) {
        setTerminalOpen(true);
      }
      createNewTerminal();
      return;
    }

    createNewTerminalTab(action.targetTerminalId);
  }, [
    createNewTerminal,
    createNewTerminalTab,
    setTerminalOpen,
    terminalState.activeTerminalGroupId,
    terminalState.activeTerminalId,
    terminalState.terminalGroups,
    terminalState.terminalOpen,
  ]);

  const moveTerminalToNewGroup = useCallback(
    (terminalId: string) => {
      if (!activeThreadId) return;
      storeNewTerminal(activeThreadId, terminalId);
      requestTerminalFocus();
    },
    [activeThreadId, requestTerminalFocus, storeNewTerminal],
  );

  const openNewFullWidthTerminal = useCallback(() => {
    if (!activeThreadId || !activeProjectExists) return;
    storeOpenNewFullWidthTerminal(activeThreadId, createTerminalId());
    requestTerminalFocus();
  }, [activeProjectExists, activeThreadId, requestTerminalFocus, storeOpenNewFullWidthTerminal]);

  const closeWorkspaceChat = useCallback(() => {
    if (!activeThreadId) return;
    storeCloseWorkspaceChat(activeThreadId);
  }, [activeThreadId, storeCloseWorkspaceChat]);

  const activateTerminal = useCallback(
    (terminalId: string) => {
      if (!activeThreadId) return;
      storeSetActiveTerminal(activeThreadId, terminalId);
      requestTerminalFocus();
    },
    [activeThreadId, requestTerminalFocus, storeSetActiveTerminal],
  );

  const closeTerminal = useCallback(
    (terminalId: string) => {
      if (!activeThreadId) return;
      storeCloseTerminal(activeThreadId, terminalId);
      requestTerminalFocus();
    },
    [activeThreadId, requestTerminalFocus, storeCloseTerminal],
  );

  const closeTerminalGroup = useCallback(
    (groupId: string) => {
      if (!activeThreadId) return;
      storeCloseTerminalGroup(activeThreadId, groupId);
    },
    [activeThreadId, storeCloseTerminalGroup],
  );

  const resizeTerminalSplit = useCallback(
    (groupId: string, splitId: string, weights: number[]) => {
      if (!activeThreadId) return;
      storeResizeTerminalSplit(activeThreadId, groupId, splitId, weights);
    },
    [activeThreadId, storeResizeTerminalSplit],
  );

  const clearTerminalState = useCallback(() => {
    if (!activeThreadId) return;
    storeClearTerminalState(activeThreadId);
  }, [activeThreadId, storeClearTerminalState]);

  return {
    terminalState,
    terminalFocusRequestId,
    requestTerminalFocus,
    terminalWorkspaceOpen,
    terminalWorkspaceTerminalTabActive,
    terminalWorkspaceChatTabActive,
    openTerminalThreadPage,
    setTerminalOpen,
    setTerminalPresentationMode,
    setTerminalWorkspaceLayout,
    setTerminalWorkspaceTab,
    setTerminalHeight,
    setTerminalMetadata,
    setTerminalActivity,
    splitTerminalRight,
    splitTerminalLeft,
    splitTerminalDown,
    splitTerminalUp,
    createNewTerminal,
    createNewTerminalTab,
    createTerminalFromShortcut,
    moveTerminalToNewGroup,
    openNewFullWidthTerminal,
    closeWorkspaceChat,
    activateTerminal,
    closeTerminal,
    closeTerminalGroup,
    resizeTerminalSplit,
    clearTerminalState,
  };
}
