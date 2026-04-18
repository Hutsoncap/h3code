// FILE: useChatViewPaneBindings.ts
// Purpose: Own ChatView's transcript/composer pane prop assembly.
// Layer: ChatView hook
// Depends on: caller-owned transcript/composer state and already-derived footer nodes.

import { type ComponentProps } from "react";

import { ChatComposerPane } from "./ChatComposerPane";
import { ChatTranscriptPane } from "./ChatTranscriptPane";

interface UseChatViewPaneBindingsOptions {
  activeThreadId: ComponentProps<typeof ChatTranscriptPane>["activeThreadId"];
  activeTurnInProgress: ComponentProps<typeof ChatTranscriptPane>["activeTurnInProgress"];
  activeTurnStartedAt: ComponentProps<typeof ChatTranscriptPane>["activeTurnStartedAt"];
  chatFontSizePx: ComponentProps<typeof ChatTranscriptPane>["chatFontSizePx"];
  completionDividerBeforeEntryId: ComponentProps<
    typeof ChatTranscriptPane
  >["completionDividerBeforeEntryId"];
  completionSummary: ComponentProps<typeof ChatTranscriptPane>["completionSummary"];
  composerActivePlanCard: ComponentProps<typeof ChatComposerPane>["activePlanCard"];
  composerCommandMenuNode: ComponentProps<typeof ChatComposerPane>["composerCommandMenu"];
  composerFooter: ComponentProps<typeof ChatComposerPane>["composerFooter"];
  composerFormRef: ComponentProps<typeof ChatComposerPane>["composerFormRef"];
  composerFrameClassName: ComponentProps<typeof ChatComposerPane>["composerFrameClassName"];
  composerImageAttachmentsNode: ComponentProps<typeof ChatComposerPane>["composerImageAttachments"];
  composerPromptEditorNode: ComponentProps<typeof ChatComposerPane>["composerPromptEditor"];
  composerStatusBanner: ComponentProps<typeof ChatComposerPane>["composerStatusBanner"];
  composerSurfaceClassName: ComponentProps<typeof ChatComposerPane>["composerSurfaceClassName"];
  emptyStateProjectName: ComponentProps<typeof ChatTranscriptPane>["emptyStateProjectName"];
  expandedWorkGroups: ComponentProps<typeof ChatTranscriptPane>["expandedWorkGroups"];
  hasMessages: ComponentProps<typeof ChatTranscriptPane>["hasMessages"];
  isDragOverComposer: ComponentProps<typeof ChatComposerPane>["isDragOverComposer"];
  isGitRepo: boolean;
  isRevertingCheckpoint: ComponentProps<typeof ChatTranscriptPane>["isRevertingCheckpoint"];
  isWorking: ComponentProps<typeof ChatTranscriptPane>["isWorking"];
  markdownCwd: ComponentProps<typeof ChatTranscriptPane>["markdownCwd"];
  messagesScrollElement: ComponentProps<typeof ChatTranscriptPane>["messagesScrollElement"];
  nowIso: ComponentProps<typeof ChatTranscriptPane>["nowIso"];
  onComposerDragEnter: ComponentProps<typeof ChatComposerPane>["onComposerDragEnter"];
  onComposerDragLeave: ComponentProps<typeof ChatComposerPane>["onComposerDragLeave"];
  onComposerDragOver: ComponentProps<typeof ChatComposerPane>["onComposerDragOver"];
  onComposerDrop: ComponentProps<typeof ChatComposerPane>["onComposerDrop"];
  onEditQueuedComposerTurn: ComponentProps<typeof ChatComposerPane>["onEditQueuedComposerTurn"];
  onExpandTimelineImage: ComponentProps<typeof ChatTranscriptPane>["onExpandTimelineImage"];
  onMessagesClickCapture: ComponentProps<typeof ChatTranscriptPane>["onMessagesClickCapture"];
  onMessagesPointerCancel: ComponentProps<typeof ChatTranscriptPane>["onMessagesPointerCancel"];
  onMessagesPointerDown: ComponentProps<typeof ChatTranscriptPane>["onMessagesPointerDown"];
  onMessagesPointerUp: ComponentProps<typeof ChatTranscriptPane>["onMessagesPointerUp"];
  onMessagesScroll: ComponentProps<typeof ChatTranscriptPane>["onMessagesScroll"];
  onMessagesTouchEnd: ComponentProps<typeof ChatTranscriptPane>["onMessagesTouchEnd"];
  onMessagesTouchMove: ComponentProps<typeof ChatTranscriptPane>["onMessagesTouchMove"];
  onMessagesTouchStart: ComponentProps<typeof ChatTranscriptPane>["onMessagesTouchStart"];
  onMessagesWheel: ComponentProps<typeof ChatTranscriptPane>["onMessagesWheel"];
  onOpenThread: ComponentProps<typeof ChatTranscriptPane>["onOpenThread"];
  onOpenTurnDiff: ComponentProps<typeof ChatTranscriptPane>["onOpenTurnDiff"];
  onRemoveQueuedComposerTurn: ComponentProps<typeof ChatComposerPane>["onRemoveQueuedComposerTurn"];
  onRevertUserMessage: ComponentProps<typeof ChatTranscriptPane>["onRevertUserMessage"];
  onScrollToBottom: ComponentProps<typeof ChatTranscriptPane>["onScrollToBottom"];
  onSend: ComponentProps<typeof ChatComposerPane>["onSend"];
  onSteerQueuedComposerTurn: ComponentProps<typeof ChatComposerPane>["onSteerQueuedComposerTurn"];
  onTimelineHeightChange: ComponentProps<typeof ChatTranscriptPane>["onTimelineHeightChange"];
  onToggleWorkGroup: ComponentProps<typeof ChatTranscriptPane>["onToggleWorkGroup"];
  paneScopeId: ComponentProps<typeof ChatComposerPane>["paneScopeId"];
  queuedComposerTurns: ComponentProps<typeof ChatComposerPane>["queuedComposerTurns"];
  resolvedTheme: ComponentProps<typeof ChatTranscriptPane>["resolvedTheme"];
  revertTurnCountByUserMessageId: ComponentProps<
    typeof ChatTranscriptPane
  >["revertTurnCountByUserMessageId"];
  scrollButtonVisible: ComponentProps<typeof ChatTranscriptPane>["scrollButtonVisible"];
  setMessagesBottomAnchorRef: ComponentProps<
    typeof ChatTranscriptPane
  >["setMessagesBottomAnchorRef"];
  setMessagesScrollContainerRef: ComponentProps<
    typeof ChatTranscriptPane
  >["setMessagesScrollContainerRef"];
  terminalWorkspaceTerminalTabActive: ComponentProps<
    typeof ChatTranscriptPane
  >["terminalWorkspaceTerminalTabActive"];
  timelineEntries: ComponentProps<typeof ChatTranscriptPane>["timelineEntries"];
  timestampFormat: ComponentProps<typeof ChatTranscriptPane>["timestampFormat"];
  turnDiffSummaryByAssistantMessageId: ComponentProps<
    typeof ChatTranscriptPane
  >["turnDiffSummaryByAssistantMessageId"];
  workspaceRoot: ComponentProps<typeof ChatTranscriptPane>["workspaceRoot"];
}

interface UseChatViewPaneBindingsResult {
  chatComposerPaneProps: ComponentProps<typeof ChatComposerPane>;
  chatTranscriptPaneProps: ComponentProps<typeof ChatTranscriptPane>;
}

export function useChatViewPaneBindings(
  options: UseChatViewPaneBindingsOptions,
): UseChatViewPaneBindingsResult {
  const chatTranscriptPaneProps: ComponentProps<typeof ChatTranscriptPane> = {
    activeThreadId: options.activeThreadId,
    hasMessages: options.hasMessages,
    isWorking: options.isWorking,
    activeTurnInProgress: options.activeTurnInProgress,
    activeTurnStartedAt: options.activeTurnStartedAt,
    messagesScrollElement: options.messagesScrollElement,
    setMessagesBottomAnchorRef: options.setMessagesBottomAnchorRef,
    setMessagesScrollContainerRef: options.setMessagesScrollContainerRef,
    timelineEntries: options.timelineEntries,
    completionDividerBeforeEntryId: options.completionDividerBeforeEntryId,
    completionSummary: options.completionSummary,
    turnDiffSummaryByAssistantMessageId: options.turnDiffSummaryByAssistantMessageId,
    nowIso: options.nowIso,
    expandedWorkGroups: options.expandedWorkGroups,
    onToggleWorkGroup: options.onToggleWorkGroup,
    onOpenTurnDiff: options.onOpenTurnDiff,
    onOpenThread: options.onOpenThread,
    revertTurnCountByUserMessageId: options.revertTurnCountByUserMessageId,
    onRevertUserMessage: options.onRevertUserMessage,
    isRevertingCheckpoint: options.isRevertingCheckpoint,
    onExpandTimelineImage: options.onExpandTimelineImage,
    onTimelineHeightChange: options.onTimelineHeightChange,
    markdownCwd: options.markdownCwd,
    resolvedTheme: options.resolvedTheme,
    chatFontSizePx: options.chatFontSizePx,
    timestampFormat: options.timestampFormat,
    workspaceRoot: options.workspaceRoot,
    emptyStateProjectName: options.emptyStateProjectName,
    terminalWorkspaceTerminalTabActive: options.terminalWorkspaceTerminalTabActive,
    onMessagesScroll: options.onMessagesScroll,
    onMessagesClickCapture: options.onMessagesClickCapture,
    onMessagesWheel: options.onMessagesWheel,
    onMessagesPointerDown: options.onMessagesPointerDown,
    onMessagesPointerUp: options.onMessagesPointerUp,
    onMessagesPointerCancel: options.onMessagesPointerCancel,
    onMessagesTouchStart: options.onMessagesTouchStart,
    onMessagesTouchMove: options.onMessagesTouchMove,
    onMessagesTouchEnd: options.onMessagesTouchEnd,
    scrollButtonVisible: options.scrollButtonVisible,
    onScrollToBottom: options.onScrollToBottom,
  };

  const chatComposerPaneProps: ComponentProps<typeof ChatComposerPane> = {
    activePlanCard: options.composerActivePlanCard,
    bottomPaddingClassName: options.isGitRepo ? "pb-1" : "pb-2.5 sm:pb-3",
    composerCommandMenu: options.composerCommandMenuNode,
    composerFooter: options.composerFooter,
    composerFormRef: options.composerFormRef,
    composerFrameClassName: options.composerFrameClassName,
    composerImageAttachments: options.composerImageAttachmentsNode,
    composerPromptEditor: options.composerPromptEditorNode,
    composerStatusBanner: options.composerStatusBanner,
    composerSurfaceClassName: options.composerSurfaceClassName,
    isDragOverComposer: options.isDragOverComposer,
    onComposerDragEnter: options.onComposerDragEnter,
    onComposerDragLeave: options.onComposerDragLeave,
    onComposerDragOver: options.onComposerDragOver,
    onComposerDrop: options.onComposerDrop,
    onEditQueuedComposerTurn: options.onEditQueuedComposerTurn,
    onRemoveQueuedComposerTurn: options.onRemoveQueuedComposerTurn,
    onSend: options.onSend,
    onSteerQueuedComposerTurn: options.onSteerQueuedComposerTurn,
    paneScopeId: options.paneScopeId,
    queuedComposerTurns: options.queuedComposerTurns,
  };

  return {
    chatComposerPaneProps,
    chatTranscriptPaneProps,
  };
}
