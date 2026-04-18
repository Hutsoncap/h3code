// FILE: useChatViewDialogBindings.ts
// Purpose: Own ChatView's remaining dialog prop assembly.
// Layer: ChatView hook
// Depends on: already-derived ChatView dialog state and handlers.

import { type ComponentProps } from "react";

import { ChatExpandedImageDialog } from "./ChatExpandedImageDialog";
import { ChatViewDialogs } from "./ChatViewDialogs";
import { ComposerSlashStatusDialog } from "./ComposerSlashStatusDialog";
import { ThreadWorktreeHandoffDialog } from "../ThreadWorktreeHandoffDialog";

interface UseChatViewDialogBindingsOptions {
  activeContextWindow: ComponentProps<typeof ComposerSlashStatusDialog>["contextWindow"];
  activeCumulativeCostUsd: ComponentProps<typeof ComposerSlashStatusDialog>["cumulativeCostUsd"];
  activeRateLimitStatus: ComponentProps<typeof ComposerSlashStatusDialog>["rateLimitStatus"];
  activeRootBranch: string | null;
  activeThreadBranch: string | null | undefined;
  confirmWorktreeHandoff: ComponentProps<typeof ThreadWorktreeHandoffDialog>["onConfirm"];
  envMode: ComponentProps<typeof ComposerSlashStatusDialog>["envMode"];
  envState: ComponentProps<typeof ComposerSlashStatusDialog>["envState"];
  expandedImage: ComponentProps<typeof ChatExpandedImageDialog>["expandedImage"];
  fastModeEnabled: ComponentProps<typeof ComposerSlashStatusDialog>["fastModeEnabled"];
  handoffBusy: ComponentProps<typeof ThreadWorktreeHandoffDialog>["busy"];
  interactionMode: ComponentProps<typeof ComposerSlashStatusDialog>["interactionMode"];
  isSlashStatusDialogOpen: ComponentProps<typeof ComposerSlashStatusDialog>["open"];
  navigateExpandedImage: ComponentProps<typeof ChatExpandedImageDialog>["onNavigate"];
  onCloseExpandedImage: ComponentProps<typeof ChatExpandedImageDialog>["onClose"];
  selectedModel: ComponentProps<typeof ComposerSlashStatusDialog>["selectedModel"];
  selectedPromptEffort: ComponentProps<typeof ComposerSlashStatusDialog>["selectedPromptEffort"];
  setIsSlashStatusDialogOpen: ComponentProps<typeof ComposerSlashStatusDialog>["onOpenChange"];
  setWorktreeHandoffDialogOpen: ComponentProps<typeof ThreadWorktreeHandoffDialog>["onOpenChange"];
  setWorktreeHandoffName: ComponentProps<
    typeof ThreadWorktreeHandoffDialog
  >["onWorktreeNameChange"];
  worktreeHandoffDialogOpen: ComponentProps<typeof ThreadWorktreeHandoffDialog>["open"];
  worktreeHandoffName: ComponentProps<typeof ThreadWorktreeHandoffDialog>["worktreeName"];
}

interface UseChatViewDialogBindingsResult {
  chatExpandedImageDialogProps: ComponentProps<typeof ChatExpandedImageDialog>;
  chatViewDialogsProps: ComponentProps<typeof ChatViewDialogs>;
}

export function useChatViewDialogBindings(
  options: UseChatViewDialogBindingsOptions,
): UseChatViewDialogBindingsResult {
  const chatViewDialogsProps: ComponentProps<typeof ChatViewDialogs> = {
    composerSlashStatusDialogProps: {
      open: options.isSlashStatusDialogOpen,
      onOpenChange: options.setIsSlashStatusDialogOpen,
      selectedModel: options.selectedModel,
      fastModeEnabled: options.fastModeEnabled,
      selectedPromptEffort: options.selectedPromptEffort,
      interactionMode: options.interactionMode,
      envMode: options.envMode,
      envState: options.envState,
      branch: options.activeThreadBranch ?? options.activeRootBranch,
      contextWindow: options.activeContextWindow,
      cumulativeCostUsd: options.activeCumulativeCostUsd,
      rateLimitStatus: options.activeRateLimitStatus,
    },
    threadWorktreeHandoffDialogProps: {
      open: options.worktreeHandoffDialogOpen,
      worktreeName: options.worktreeHandoffName,
      busy: options.handoffBusy ?? false,
      onWorktreeNameChange: options.setWorktreeHandoffName,
      onOpenChange: options.setWorktreeHandoffDialogOpen,
      onConfirm: options.confirmWorktreeHandoff,
    },
  };

  const chatExpandedImageDialogProps: ComponentProps<typeof ChatExpandedImageDialog> = {
    expandedImage: options.expandedImage,
    onClose: options.onCloseExpandedImage,
    onNavigate: options.navigateExpandedImage,
  };

  return {
    chatExpandedImageDialogProps,
    chatViewDialogsProps,
  };
}
