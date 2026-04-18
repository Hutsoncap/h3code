// FILE: useChatTerminalShortcutBindings.ts
// Purpose: Own ChatView's terminal-focus and global shortcut controller.
// Layer: ChatView hook
// Depends on: terminal workspace state, keyboard config, and existing action callbacks.

import {
  type ProjectScript,
  type ResolvedKeybindingsConfig,
  type ThreadId,
} from "@t3tools/contracts";
import { type RefObject, useEffect, useMemo, useRef } from "react";

import { resolveShortcutCommand, shortcutLabelForCommand } from "../../keybindings";
import { isTerminalFocused } from "../../lib/terminalFocus";
import type { ThreadPrimarySurface } from "../../types";
import { isMacPlatform } from "~/lib/utils";
import { projectScriptIdFromCommand } from "~/projectScripts";

interface TerminalShortcutState {
  activeTerminalId: string;
  entryPoint: ThreadPrimarySurface;
  open: boolean;
  workspaceActiveTab: "terminal" | "chat";
  workspaceLayout: "both" | "terminal-only";
}

interface UseChatTerminalShortcutBindingsOptions {
  activeProjectScripts: ReadonlyArray<ProjectScript> | undefined;
  activeThreadId: ThreadId | null;
  closeActiveWorkspaceView: () => void;
  closeTerminal: (terminalId: string) => void | Promise<void>;
  composerFormRef: RefObject<HTMLFormElement | null>;
  createTerminalFromShortcut: () => void;
  focusComposer: () => void;
  hasLiveTurn: boolean;
  isElectron: boolean;
  isFocusedPane: boolean;
  keybindings: ResolvedKeybindingsConfig;
  onInterrupt: () => void | Promise<void>;
  onSplitSurface: (() => void) | undefined;
  onToggleBrowser: () => void;
  onToggleDiff: () => void;
  openNewFullWidthTerminal: () => void;
  openTerminalThreadPage: () => void;
  requestTerminalFocus: () => void;
  runProjectScript: (script: ProjectScript) => void | Promise<void>;
  setTerminalOpen: (open: boolean) => void;
  setTerminalWorkspaceTab: (tab: "terminal" | "chat") => void;
  splitTerminalDown: () => void;
  splitTerminalLeft: () => void;
  splitTerminalRight: () => void;
  splitTerminalUp: () => void;
  surfaceMode: "single" | "split";
  terminalState: TerminalShortcutState;
  terminalWorkspaceChatTabActive: boolean;
  terminalWorkspaceOpen: boolean;
  terminalWorkspaceTerminalTabActive: boolean;
  toggleTerminalVisibility: () => void;
}

interface UseChatTerminalShortcutBindingsResult {
  browserPanelShortcutLabel: string | null;
  chatSplitShortcutLabel: string | null;
  closeTerminalShortcutLabel: string | null;
  closeWorkspaceShortcutLabel: string | null;
  diffPanelShortcutLabel: string | null;
  newTerminalShortcutLabel: string | null;
  splitTerminalDownShortcutLabel: string | null;
  splitTerminalShortcutLabel: string | null;
  terminalToggleShortcutLabel: string | null;
}

function eventTargetsComposer(
  event: globalThis.KeyboardEvent,
  composerFormRef: RefObject<HTMLFormElement | null>,
): boolean {
  const composerForm = composerFormRef.current;
  if (!composerForm) return false;
  const target = event.target;
  return target instanceof Node ? composerForm.contains(target) : false;
}

// Keeps ChatView focused on orchestration while this hook owns terminal focus and keyboard control.
export function useChatTerminalShortcutBindings(
  options: UseChatTerminalShortcutBindingsOptions,
): UseChatTerminalShortcutBindingsResult {
  const {
    activeProjectScripts,
    activeThreadId,
    closeActiveWorkspaceView,
    closeTerminal,
    composerFormRef,
    createTerminalFromShortcut,
    focusComposer,
    hasLiveTurn,
    isElectron,
    isFocusedPane,
    keybindings,
    onInterrupt,
    onSplitSurface,
    onToggleBrowser,
    onToggleDiff,
    openNewFullWidthTerminal,
    openTerminalThreadPage,
    requestTerminalFocus,
    runProjectScript,
    setTerminalOpen,
    setTerminalWorkspaceTab,
    splitTerminalDown,
    splitTerminalLeft,
    splitTerminalRight,
    splitTerminalUp,
    surfaceMode,
    terminalState,
    terminalWorkspaceChatTabActive,
    terminalWorkspaceOpen,
    terminalWorkspaceTerminalTabActive,
    toggleTerminalVisibility,
  } = options;
  const terminalOpenByThreadRef = useRef<Record<string, boolean>>({});
  const activatedThreadIdRef = useRef<ThreadId | null>(null);

  const shortcutLabels = useMemo(
    () => ({
      terminalToggleShortcutLabel: shortcutLabelForCommand(keybindings, "terminal.toggle"),
      splitTerminalShortcutLabel:
        shortcutLabelForCommand(keybindings, "terminal.splitRight") ??
        shortcutLabelForCommand(keybindings, "terminal.split"),
      splitTerminalDownShortcutLabel: shortcutLabelForCommand(keybindings, "terminal.splitDown"),
      newTerminalShortcutLabel: shortcutLabelForCommand(keybindings, "terminal.new"),
      closeTerminalShortcutLabel: shortcutLabelForCommand(keybindings, "terminal.close"),
      closeWorkspaceShortcutLabel: shortcutLabelForCommand(
        keybindings,
        "terminal.workspace.closeActive",
      ),
      diffPanelShortcutLabel: shortcutLabelForCommand(keybindings, "diff.toggle"),
      browserPanelShortcutLabel: shortcutLabelForCommand(keybindings, "browser.toggle"),
      chatSplitShortcutLabel: shortcutLabelForCommand(keybindings, "chat.split"),
    }),
    [keybindings],
  );

  // Desktop accelerators like Cmd+T can be claimed by Electron before the page sees keydown.
  useEffect(() => {
    const onMenuAction = window.desktopBridge?.onMenuAction;
    if (typeof onMenuAction !== "function" || !isFocusedPane) {
      return;
    }

    const unsubscribe = onMenuAction((action) => {
      if (action !== "new-terminal-tab") return;
      createTerminalFromShortcut();
    });

    return () => {
      unsubscribe?.();
    };
  }, [createTerminalFromShortcut, isFocusedPane]);

  useEffect(() => {
    if (!activeThreadId) return;
    const previous = terminalOpenByThreadRef.current[activeThreadId] ?? false;
    const current = terminalState.open;

    if (!previous && current) {
      terminalOpenByThreadRef.current[activeThreadId] = current;
      requestTerminalFocus();
      return;
    }

    if (previous && !current) {
      terminalOpenByThreadRef.current[activeThreadId] = current;
      const frame = window.requestAnimationFrame(() => {
        focusComposer();
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    terminalOpenByThreadRef.current[activeThreadId] = current;
  }, [activeThreadId, focusComposer, requestTerminalFocus, terminalState.open]);

  useEffect(() => {
    if (!activeThreadId) {
      activatedThreadIdRef.current = null;
      return;
    }
    if (activatedThreadIdRef.current === activeThreadId) {
      return;
    }
    activatedThreadIdRef.current = activeThreadId;
    if (terminalState.entryPoint !== "terminal") {
      return;
    }
    openTerminalThreadPage();
  }, [activeThreadId, openTerminalThreadPage, terminalState.entryPoint]);

  useEffect(() => {
    if (!terminalWorkspaceOpen) {
      return;
    }

    if (terminalState.workspaceActiveTab === "terminal") {
      requestTerminalFocus();
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      focusComposer();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    focusComposer,
    requestTerminalFocus,
    terminalState.workspaceActiveTab,
    terminalWorkspaceOpen,
  ]);

  useEffect(() => {
    if (surfaceMode === "split" && !isFocusedPane) {
      return;
    }

    const handler = (event: globalThis.KeyboardEvent) => {
      if (!activeThreadId || event.defaultPrevented) return;

      // Mirror terminal interrupt semantics without stealing regular copy shortcuts.
      if (
        hasLiveTurn &&
        isMacPlatform(navigator.platform) &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "c" &&
        eventTargetsComposer(event, composerFormRef)
      ) {
        event.preventDefault();
        event.stopPropagation();
        void onInterrupt();
        return;
      }

      const shortcutContext = {
        terminalFocus: isTerminalFocused(),
        terminalOpen: terminalState.open,
        terminalWorkspaceOpen,
        terminalWorkspaceTerminalOnly: terminalState.workspaceLayout === "terminal-only",
        terminalWorkspaceTerminalTabActive,
        terminalWorkspaceChatTabActive,
      };

      const command = resolveShortcutCommand(event, keybindings, { context: shortcutContext });
      if (!command) return;

      if (command === "terminal.toggle") {
        event.preventDefault();
        event.stopPropagation();
        toggleTerminalVisibility();
        return;
      }

      if (command === "terminal.split" || command === "terminal.splitRight") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.open) {
          setTerminalOpen(true);
        }
        splitTerminalRight();
        return;
      }

      if (command === "terminal.splitLeft") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.open) {
          setTerminalOpen(true);
        }
        splitTerminalLeft();
        return;
      }

      if (command === "terminal.splitDown") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.open) {
          setTerminalOpen(true);
        }
        splitTerminalDown();
        return;
      }

      if (command === "terminal.splitUp") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.open) {
          setTerminalOpen(true);
        }
        splitTerminalUp();
        return;
      }

      if (command === "terminal.close") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.open) return;
        void closeTerminal(terminalState.activeTerminalId);
        return;
      }

      if (command === "terminal.new") {
        event.preventDefault();
        event.stopPropagation();
        createTerminalFromShortcut();
        return;
      }

      if (command === "terminal.workspace.newFullWidth") {
        event.preventDefault();
        event.stopPropagation();
        openNewFullWidthTerminal();
        return;
      }

      if (command === "terminal.workspace.closeActive") {
        event.preventDefault();
        event.stopPropagation();
        closeActiveWorkspaceView();
        return;
      }

      if (command === "terminal.workspace.terminal") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalWorkspaceOpen) return;
        setTerminalWorkspaceTab("terminal");
        return;
      }

      if (command === "terminal.workspace.chat") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalWorkspaceOpen) return;
        setTerminalWorkspaceTab("chat");
        return;
      }

      if (command === "diff.toggle") {
        event.preventDefault();
        event.stopPropagation();
        onToggleDiff();
        return;
      }

      if (command === "browser.toggle") {
        event.preventDefault();
        event.stopPropagation();
        if (!isElectron) return;
        onToggleBrowser();
        return;
      }

      if (command === "chat.split") {
        event.preventDefault();
        event.stopPropagation();
        if (surfaceMode === "single" && onSplitSurface) {
          onSplitSurface();
        }
        return;
      }

      const scriptId = projectScriptIdFromCommand(command);
      if (!scriptId || !activeProjectScripts) return;
      const script = activeProjectScripts.find((entry) => entry.id === scriptId);
      if (!script) return;
      event.preventDefault();
      event.stopPropagation();
      void runProjectScript(script);
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [
    activeProjectScripts,
    activeThreadId,
    closeActiveWorkspaceView,
    closeTerminal,
    composerFormRef,
    createTerminalFromShortcut,
    hasLiveTurn,
    isElectron,
    isFocusedPane,
    keybindings,
    onInterrupt,
    onSplitSurface,
    onToggleBrowser,
    onToggleDiff,
    openNewFullWidthTerminal,
    runProjectScript,
    setTerminalOpen,
    setTerminalWorkspaceTab,
    splitTerminalDown,
    splitTerminalLeft,
    splitTerminalRight,
    splitTerminalUp,
    surfaceMode,
    terminalState.activeTerminalId,
    terminalState.open,
    terminalState.workspaceLayout,
    terminalWorkspaceChatTabActive,
    terminalWorkspaceOpen,
    terminalWorkspaceTerminalTabActive,
    toggleTerminalVisibility,
  ]);

  return shortcutLabels;
}
