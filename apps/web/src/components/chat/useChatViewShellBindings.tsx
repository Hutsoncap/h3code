// FILE: useChatViewShellBindings.tsx
// Purpose: Own ChatView's remaining shell prop assembly and auxiliary shell nodes.
// Layer: ChatView hook
// Depends on: caller-owned chat pane props, shell state, and workspace action handlers.

import { type ComponentProps } from "react";

import { cn } from "~/lib/utils";

import BranchToolbar from "../BranchToolbar";
import PlanSidebar from "../PlanSidebar";
import ThreadTerminalDrawer from "../ThreadTerminalDrawer";
import TerminalWorkspaceTabs from "../TerminalWorkspaceTabs";
import { ChatBodyPane } from "./ChatBodyPane";
import { ChatHeader } from "./ChatHeader";
import { ChatPullRequestDialog } from "./ChatPullRequestDialog";
import { ChatThreadPane } from "./ChatThreadPane";

type BaseTerminalDrawerProps = Omit<
  ComponentProps<typeof ThreadTerminalDrawer>,
  "presentationMode" | "isVisible" | "onTogglePresentationMode"
>;

interface UseChatViewShellBindingsOptions {
  activeContextWindow: ComponentProps<typeof BranchToolbar>["contextWindow"];
  activeCumulativeCostUsd: ComponentProps<typeof BranchToolbar>["cumulativeCostUsd"];
  activePlan: ComponentProps<typeof PlanSidebar>["activePlan"];
  activeProjectCwd: string | undefined;
  activeProjectName: ComponentProps<typeof ChatHeader>["activeProjectName"];
  activeProjectScripts: ComponentProps<typeof ChatHeader>["activeProjectScripts"];
  activeProviderStatus: ComponentProps<typeof ChatThreadPane>["providerStatus"];
  activeRateLimitStatus: ComponentProps<typeof ChatThreadPane>["rateLimitStatus"];
  activeThreadError: ComponentProps<typeof ChatThreadPane>["threadError"];
  activeThreadId: ComponentProps<typeof ChatHeader>["activeThreadId"];
  activeThreadTitle: ComponentProps<typeof ChatHeader>["activeThreadTitle"];
  availableEditors: ComponentProps<typeof ChatHeader>["availableEditors"];
  browserOpen: ComponentProps<typeof ChatHeader>["browserOpen"];
  browserToggleShortcutLabel: ComponentProps<typeof ChatHeader>["browserToggleShortcutLabel"];
  canCheckoutPullRequestIntoThread: boolean;
  chatComposerPaneProps: ComponentProps<typeof ChatBodyPane>["chatComposerPaneProps"];
  chatLayoutAction: ComponentProps<typeof ChatHeader>["chatLayoutAction"];
  chatTranscriptPaneProps: ComponentProps<typeof ChatBodyPane>["chatTranscriptPaneProps"];
  collapseTerminalWorkspace: () => void;
  diffDisabledReason: ComponentProps<typeof ChatHeader>["diffDisabledReason"];
  diffOpen: ComponentProps<typeof ChatHeader>["diffOpen"];
  diffToggleShortcutLabel: ComponentProps<typeof ChatHeader>["diffToggleShortcutLabel"];
  dismissActiveThreadError: ComponentProps<typeof ChatThreadPane>["onDismissThreadError"];
  envLocked: ComponentProps<typeof BranchToolbar>["envLocked"];
  expandTerminalWorkspace: () => void;
  gitCwd: ComponentProps<typeof ChatHeader>["gitCwd"];
  handoffActionLabel: ComponentProps<typeof ChatHeader>["handoffActionLabel"];
  handoffActionTargetProvider: ComponentProps<typeof ChatHeader>["handoffActionTargetProvider"];
  handoffBadgeLabel: ComponentProps<typeof ChatHeader>["handoffBadgeLabel"];
  handoffBadgeSourceProvider: ComponentProps<typeof ChatHeader>["handoffBadgeSourceProvider"];
  handoffBadgeTargetProvider: ComponentProps<typeof ChatHeader>["handoffBadgeTargetProvider"];
  handoffBusy: ComponentProps<typeof BranchToolbar>["handoffBusy"];
  handoffDisabled: ComponentProps<typeof ChatHeader>["handoffDisabled"];
  hideHandoffControls: boolean;
  isElectron: ComponentProps<typeof ChatThreadPane>["isElectron"];
  isGitRepo: ComponentProps<typeof ChatHeader>["isGitRepo"];
  keybindings: ComponentProps<typeof ChatHeader>["keybindings"];
  markdownCwd: ComponentProps<typeof PlanSidebar>["markdownCwd"];
  onAddProjectScript: ComponentProps<typeof ChatHeader>["onAddProjectScript"];
  onClosePlanSidebar: ComponentProps<typeof PlanSidebar>["onClose"];
  onClosePullRequestDialog: ComponentProps<typeof ChatPullRequestDialog>["onClose"];
  onComposerFocusRequest: ComponentProps<typeof BranchToolbar>["onComposerFocusRequest"];
  onCreateHandoff: ComponentProps<typeof ChatHeader>["onCreateHandoff"];
  onDeleteProjectScript: ComponentProps<typeof ChatHeader>["onDeleteProjectScript"];
  onEnvModeChange: ComponentProps<typeof BranchToolbar>["onEnvModeChange"];
  onHandoffToLocal: ComponentProps<typeof BranchToolbar>["onHandoffToLocal"];
  onHandoffToWorktree: ComponentProps<typeof BranchToolbar>["onHandoffToWorktree"];
  onNavigateToThread: ComponentProps<typeof ChatHeader>["onNavigateToThread"];
  onPreparedPullRequestThread: ComponentProps<typeof ChatPullRequestDialog>["onPrepared"];
  onRunProjectScript: ComponentProps<typeof ChatHeader>["onRunProjectScript"];
  onRuntimeModeChange: ComponentProps<typeof BranchToolbar>["onRuntimeModeChange"];
  onToggleBrowser: ComponentProps<typeof ChatHeader>["onToggleBrowser"];
  onToggleDiff: ComponentProps<typeof ChatHeader>["onToggleDiff"];
  onToggleTerminal: ComponentProps<typeof ChatHeader>["onToggleTerminal"];
  onUpdateProjectScript: ComponentProps<typeof ChatHeader>["onUpdateProjectScript"];
  openInCwd: ComponentProps<typeof ChatHeader>["openInCwd"];
  openPullRequestDialog: NonNullable<
    ComponentProps<typeof BranchToolbar>["onCheckoutPullRequestRequest"]
  >;
  planSidebarOpen: boolean;
  preferredScriptId: ComponentProps<typeof ChatHeader>["preferredScriptId"];
  pullRequestDialogState: ComponentProps<typeof ChatPullRequestDialog>["dialogState"];
  runtimeMode: ComponentProps<typeof BranchToolbar>["runtimeMode"];
  sidebarProposedPlan: ComponentProps<typeof PlanSidebar>["activeProposedPlan"];
  sidebarSide: ComponentProps<typeof ChatThreadPane>["sidebarSide"];
  surfaceMode: NonNullable<ComponentProps<typeof ChatHeader>["surfaceMode"]>;
  terminalAvailable: ComponentProps<typeof ChatHeader>["terminalAvailable"];
  terminalCount: number;
  terminalDrawerProps: BaseTerminalDrawerProps;
  terminalOpen: ComponentProps<typeof ChatHeader>["terminalOpen"];
  terminalRunningCount: number;
  terminalToggleShortcutLabel: ComponentProps<typeof ChatHeader>["terminalToggleShortcutLabel"];
  terminalWorkspaceActiveTab: ComponentProps<typeof TerminalWorkspaceTabs>["activeTab"];
  terminalWorkspaceLayout: ComponentProps<typeof TerminalWorkspaceTabs>["workspaceLayout"];
  terminalWorkspaceOpen: boolean;
  terminalWorkspaceTerminalTabActive: boolean;
  onSelectTerminalWorkspaceTab: ComponentProps<typeof TerminalWorkspaceTabs>["onSelectTab"];
  threadBreadcrumbs: ComponentProps<typeof ChatHeader>["threadBreadcrumbs"];
  timestampFormat: ComponentProps<typeof PlanSidebar>["timestampFormat"];
  workspaceRoot: ComponentProps<typeof PlanSidebar>["workspaceRoot"];
}

interface UseChatViewShellBindingsResult {
  chatThreadPaneProps: ComponentProps<typeof ChatThreadPane>;
}

// Keeps ChatView focused on state derivation while this helper assembles the shell chrome.
export function useChatViewShellBindings(
  options: UseChatViewShellBindingsOptions,
): UseChatViewShellBindingsResult {
  const terminalWorkspaceTabProps: ComponentProps<typeof TerminalWorkspaceTabs> = {
    activeTab: options.terminalWorkspaceActiveTab,
    isWorking: options.chatTranscriptPaneProps.isWorking,
    terminalHasRunningActivity: options.terminalRunningCount > 0,
    terminalCount: options.terminalCount,
    workspaceLayout: options.terminalWorkspaceLayout,
    onSelectTab: options.onSelectTerminalWorkspaceTab,
  };

  const chatHeaderProps: ComponentProps<typeof ChatHeader> = {
    activeThreadId: options.activeThreadId,
    activeThreadTitle: options.activeThreadTitle,
    activeProjectName: options.activeProjectName,
    threadBreadcrumbs: options.threadBreadcrumbs,
    hideHandoffControls: options.hideHandoffControls,
    isGitRepo: options.isGitRepo,
    openInCwd: options.openInCwd,
    activeProjectScripts: options.activeProjectScripts,
    preferredScriptId: options.preferredScriptId,
    keybindings: options.keybindings,
    availableEditors: options.availableEditors,
    terminalAvailable: options.terminalAvailable,
    terminalOpen: options.terminalOpen,
    terminalToggleShortcutLabel: options.terminalToggleShortcutLabel,
    browserToggleShortcutLabel: options.browserToggleShortcutLabel,
    diffToggleShortcutLabel: options.diffToggleShortcutLabel,
    handoffBadgeLabel: options.handoffBadgeLabel,
    handoffActionLabel: options.handoffActionLabel,
    handoffDisabled: options.handoffDisabled,
    handoffActionTargetProvider: options.handoffActionTargetProvider,
    handoffBadgeSourceProvider: options.handoffBadgeSourceProvider,
    handoffBadgeTargetProvider: options.handoffBadgeTargetProvider,
    browserOpen: options.browserOpen,
    gitCwd: options.gitCwd,
    diffOpen: options.diffOpen,
    ...(options.diffDisabledReason !== undefined
      ? { diffDisabledReason: options.diffDisabledReason }
      : {}),
    surfaceMode: options.surfaceMode,
    ...(options.chatLayoutAction !== undefined
      ? { chatLayoutAction: options.chatLayoutAction }
      : {}),
    onRunProjectScript: options.onRunProjectScript,
    onAddProjectScript: options.onAddProjectScript,
    onUpdateProjectScript: options.onUpdateProjectScript,
    onDeleteProjectScript: options.onDeleteProjectScript,
    onToggleTerminal: options.onToggleTerminal,
    onToggleDiff: options.onToggleDiff,
    onToggleBrowser: options.onToggleBrowser,
    onCreateHandoff: options.onCreateHandoff,
    onNavigateToThread: options.onNavigateToThread,
  };

  const branchToolbarNode = options.isGitRepo ? (
    <BranchToolbar
      threadId={options.activeThreadId}
      onEnvModeChange={options.onEnvModeChange}
      envLocked={options.envLocked}
      {...(options.runtimeMode ? { runtimeMode: options.runtimeMode } : {})}
      {...(options.onRuntimeModeChange ? { onRuntimeModeChange: options.onRuntimeModeChange } : {})}
      {...(options.onHandoffToWorktree ? { onHandoffToWorktree: options.onHandoffToWorktree } : {})}
      {...(options.onHandoffToLocal ? { onHandoffToLocal: options.onHandoffToLocal } : {})}
      {...(options.handoffBusy ? { handoffBusy: options.handoffBusy } : {})}
      {...(options.onComposerFocusRequest
        ? { onComposerFocusRequest: options.onComposerFocusRequest }
        : {})}
      {...(options.activeContextWindow ? { contextWindow: options.activeContextWindow } : {})}
      {...(options.activeCumulativeCostUsd !== null && options.activeCumulativeCostUsd !== undefined
        ? { cumulativeCostUsd: options.activeCumulativeCostUsd }
        : {})}
      {...(options.canCheckoutPullRequestIntoThread
        ? { onCheckoutPullRequestRequest: options.openPullRequestDialog }
        : {})}
    />
  ) : null;

  const pullRequestDialogNode = (
    <ChatPullRequestDialog
      dialogState={options.pullRequestDialogState}
      cwd={options.activeProjectCwd ?? null}
      onClose={options.onClosePullRequestDialog}
      onPrepared={options.onPreparedPullRequestThread}
    />
  );

  const workspaceTerminalDrawer = options.terminalWorkspaceOpen ? (
    <div
      aria-hidden={!options.terminalWorkspaceTerminalTabActive}
      className={cn(
        "absolute inset-0 min-h-0 min-w-0 transition-all duration-200 ease-out",
        options.terminalWorkspaceTerminalTabActive
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-1 opacity-0",
      )}
    >
      <ThreadTerminalDrawer
        {...options.terminalDrawerProps}
        presentationMode="workspace"
        isVisible={options.terminalWorkspaceTerminalTabActive}
        onTogglePresentationMode={
          options.terminalWorkspaceLayout === "both" ? options.collapseTerminalWorkspace : undefined
        }
      />
    </div>
  ) : null;

  const planSidebarNode = options.planSidebarOpen ? (
    <PlanSidebar
      activePlan={options.activePlan}
      activeProposedPlan={options.sidebarProposedPlan}
      markdownCwd={options.markdownCwd}
      workspaceRoot={options.workspaceRoot}
      timestampFormat={options.timestampFormat}
      onClose={options.onClosePlanSidebar}
    />
  ) : null;

  const terminalDrawerNode =
    !options.terminalOpen || !options.activeProjectCwd || options.terminalWorkspaceOpen ? null : (
      <ThreadTerminalDrawer
        {...options.terminalDrawerProps}
        presentationMode="drawer"
        onTogglePresentationMode={options.expandTerminalWorkspace}
      />
    );

  const chatThreadPaneProps: ComponentProps<typeof ChatThreadPane> = {
    bodyProps: {
      branchToolbar: branchToolbarNode,
      chatComposerPaneProps: options.chatComposerPaneProps,
      chatTranscriptPaneProps: options.chatTranscriptPaneProps,
      planSidebar: planSidebarNode,
      pullRequestDialog: pullRequestDialogNode,
      terminalWorkspaceOpen: options.terminalWorkspaceOpen,
      terminalWorkspaceTerminalTabActive: options.terminalWorkspaceTerminalTabActive,
      workspaceTerminalDrawer,
    },
    headerProps: chatHeaderProps,
    isElectron: options.isElectron,
    rateLimitStatus: options.activeRateLimitStatus,
    providerStatus: options.activeProviderStatus,
    sidebarSide: options.sidebarSide,
    terminalDrawer: terminalDrawerNode,
    terminalWorkspaceOpen: options.terminalWorkspaceOpen,
    terminalWorkspaceTabProps,
    threadError: options.activeThreadError,
    onDismissThreadError: options.dismissActiveThreadError,
  };

  return { chatThreadPaneProps };
}
