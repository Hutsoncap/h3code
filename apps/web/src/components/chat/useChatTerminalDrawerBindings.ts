// FILE: useChatTerminalDrawerBindings.ts
// Purpose: Own ChatView's terminal drawer prop assembly.
// Layer: ChatView hook
// Depends on: caller-owned terminal state, shortcuts, and terminal context handlers.

import { type ComponentProps, useMemo } from "react";

import ThreadTerminalDrawer from "../ThreadTerminalDrawer";
import type { ChatTerminalBindings } from "./useChatTerminalBindings";

type ChatTerminalDrawerProps = Omit<
  ComponentProps<typeof ThreadTerminalDrawer>,
  "presentationMode" | "isVisible" | "onTogglePresentationMode"
>;

interface UseChatTerminalDrawerBindingsOptions {
  activateTerminal: ComponentProps<typeof ThreadTerminalDrawer>["onActiveTerminalChange"];
  activeProjectCwd: string | undefined;
  addTerminalContextToDraft: ComponentProps<typeof ThreadTerminalDrawer>["onAddTerminalContext"];
  closeTerminal: ComponentProps<typeof ThreadTerminalDrawer>["onCloseTerminal"];
  closeTerminalGroup: ComponentProps<typeof ThreadTerminalDrawer>["onCloseTerminalGroup"];
  closeTerminalShortcutLabel: string | null;
  closeWorkspaceShortcutLabel: string | null;
  createNewTerminal: ComponentProps<typeof ThreadTerminalDrawer>["onNewTerminal"];
  createNewTerminalTab: ComponentProps<typeof ThreadTerminalDrawer>["onNewTerminalTab"];
  gitCwd: string | null;
  moveTerminalToNewGroup: ComponentProps<typeof ThreadTerminalDrawer>["onMoveTerminalToGroup"];
  newTerminalShortcutLabel: string | null;
  resizeTerminalSplit: ComponentProps<typeof ThreadTerminalDrawer>["onResizeTerminalSplit"];
  setTerminalActivity: ComponentProps<typeof ThreadTerminalDrawer>["onTerminalActivityChange"];
  setTerminalHeight: ComponentProps<typeof ThreadTerminalDrawer>["onHeightChange"];
  setTerminalMetadata: ComponentProps<typeof ThreadTerminalDrawer>["onTerminalMetadataChange"];
  splitTerminalDown: ComponentProps<typeof ThreadTerminalDrawer>["onSplitTerminalDown"];
  splitTerminalDownShortcutLabel: string | null;
  splitTerminalRight: ComponentProps<typeof ThreadTerminalDrawer>["onSplitTerminal"];
  splitTerminalShortcutLabel: string | null;
  terminalFocusRequestId: ComponentProps<typeof ThreadTerminalDrawer>["focusRequestId"];
  terminalState: ChatTerminalBindings["terminalState"];
  threadId: ComponentProps<typeof ThreadTerminalDrawer>["threadId"];
  threadTerminalRuntimeEnv: ComponentProps<typeof ThreadTerminalDrawer>["runtimeEnv"];
}

export function useChatTerminalDrawerBindings(
  options: UseChatTerminalDrawerBindingsOptions,
): ChatTerminalDrawerProps {
  return useMemo(
    () => ({
      threadId: options.threadId,
      cwd: options.gitCwd ?? options.activeProjectCwd ?? "",
      ...(options.threadTerminalRuntimeEnv ? { runtimeEnv: options.threadTerminalRuntimeEnv } : {}),
      height: options.terminalState.terminalHeight,
      terminalIds: options.terminalState.terminalIds,
      terminalLabelsById: options.terminalState.terminalLabelsById,
      terminalTitleOverridesById: options.terminalState.terminalTitleOverridesById,
      terminalCliKindsById: options.terminalState.terminalCliKindsById,
      terminalAttentionStatesById: options.terminalState.terminalAttentionStatesById ?? {},
      runningTerminalIds: options.terminalState.runningTerminalIds,
      activeTerminalId: options.terminalState.activeTerminalId,
      terminalGroups: options.terminalState.terminalGroups,
      activeTerminalGroupId: options.terminalState.activeTerminalGroupId,
      focusRequestId: options.terminalFocusRequestId,
      onSplitTerminal: options.splitTerminalRight,
      onSplitTerminalDown: options.splitTerminalDown,
      onNewTerminal: options.createNewTerminal,
      onNewTerminalTab: options.createNewTerminalTab,
      onMoveTerminalToGroup: options.moveTerminalToNewGroup,
      splitShortcutLabel: options.splitTerminalShortcutLabel ?? undefined,
      splitDownShortcutLabel: options.splitTerminalDownShortcutLabel ?? undefined,
      newShortcutLabel: options.newTerminalShortcutLabel ?? undefined,
      closeShortcutLabel: options.closeTerminalShortcutLabel ?? undefined,
      workspaceCloseShortcutLabel: options.closeWorkspaceShortcutLabel ?? undefined,
      onActiveTerminalChange: options.activateTerminal,
      onCloseTerminal: options.closeTerminal,
      onCloseTerminalGroup: options.closeTerminalGroup,
      onHeightChange: options.setTerminalHeight,
      onResizeTerminalSplit: options.resizeTerminalSplit,
      onTerminalMetadataChange: options.setTerminalMetadata,
      onTerminalActivityChange: options.setTerminalActivity,
      onAddTerminalContext: options.addTerminalContextToDraft,
    }),
    [
      options.activateTerminal,
      options.activeProjectCwd,
      options.addTerminalContextToDraft,
      options.closeTerminal,
      options.closeTerminalGroup,
      options.closeTerminalShortcutLabel,
      options.closeWorkspaceShortcutLabel,
      options.createNewTerminal,
      options.createNewTerminalTab,
      options.gitCwd,
      options.moveTerminalToNewGroup,
      options.newTerminalShortcutLabel,
      options.resizeTerminalSplit,
      options.setTerminalActivity,
      options.setTerminalHeight,
      options.setTerminalMetadata,
      options.splitTerminalDown,
      options.splitTerminalDownShortcutLabel,
      options.splitTerminalRight,
      options.splitTerminalShortcutLabel,
      options.terminalFocusRequestId,
      options.terminalState.activeTerminalGroupId,
      options.terminalState.activeTerminalId,
      options.terminalState.runningTerminalIds,
      options.terminalState.terminalAttentionStatesById,
      options.terminalState.terminalCliKindsById,
      options.terminalState.terminalGroups,
      options.terminalState.terminalHeight,
      options.terminalState.terminalIds,
      options.terminalState.terminalLabelsById,
      options.terminalState.terminalTitleOverridesById,
      options.threadId,
      options.threadTerminalRuntimeEnv,
    ],
  );
}
