// FILE: useChatComposerFooterBindings.ts
// Purpose: Own ChatView's remaining composer render/footer binding cluster.
// Layer: ChatView hook
// Depends on: caller-owned composer state, action handlers, and presentation components.

import { type ProviderInteractionMode } from "@t3tools/contracts";
import { type ComponentProps, type MutableRefObject, type ReactNode } from "react";
import { GoTasklist } from "react-icons/go";

import { type PendingUserInputProgress } from "../../pendingUserInput";
import { type SessionPhase } from "../../types";
import { cn } from "~/lib/utils";
import { ChevronDownIcon } from "~/lib/icons";

import { ComposerPromptEditor, type ComposerPromptEditorHandle } from "../ComposerPromptEditor";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Separator } from "../ui/separator";
import { ChatActivePlanCard } from "./ChatActivePlanCard";
import { ChatComposerFooter } from "./ChatComposerFooter";
import { ChatComposerStatusBanner } from "./ChatComposerStatusBanner";
import { ComposerCommandMenu } from "./ComposerCommandMenu";
import { ComposerExtrasMenu } from "./ComposerExtrasMenu";
import { ComposerImageAttachmentChip } from "./ComposerImageAttachmentChip";
import { ComposerPendingApprovalActions } from "./ComposerPendingApprovalActions";
import { ComposerVoiceButton } from "./ComposerVoiceButton";
import { ComposerVoiceRecorderBar } from "./ComposerVoiceRecorderBar";
import { ProviderModelPicker } from "./ProviderModelPicker";

interface UseChatComposerFooterBindingsOptions {
  activePlan: ComponentProps<typeof ChatActivePlanCard>["activePlan"];
  activePendingApproval: ComponentProps<typeof ChatComposerStatusBanner>["activePendingApproval"];
  activePendingDraftAnswers: ComponentProps<
    typeof ChatComposerStatusBanner
  >["activePendingDraftAnswers"];
  activePendingIsResponding: boolean;
  activePendingProgress: PendingUserInputProgress | null;
  activePendingQuestionIndex: number;
  activePendingResolvedAnswers: boolean;
  activePlanBackgroundTaskCount: number;
  activeProposedPlanTitle: string | null;
  composerCommandMenuItems: ComponentProps<typeof ComposerCommandMenu>["items"];
  composerCommandMenuTriggerKind: ComponentProps<typeof ComposerCommandMenu>["triggerKind"];
  composerCursor: number;
  composerEditorRef: MutableRefObject<ComposerPromptEditorHandle | null>;
  composerImages: ReadonlyArray<ComponentProps<typeof ComposerImageAttachmentChip>["image"]>;
  composerMenuActiveItemId: string | null;
  composerMenuOpen: boolean;
  composerPromptPlaceholder: string;
  composerPromptValue: string;
  composerTerminalContexts: ComponentProps<typeof ComposerPromptEditor>["terminalContexts"];
  fastModeEnabled: boolean;
  hasComposerSendableContent: boolean;
  interactionMode: ProviderInteractionMode;
  isComposerApprovalState: boolean;
  isComposerDisabled: boolean;
  isComposerFooterCompact: boolean;
  isComposerMenuLoading: boolean;
  isConnecting: boolean;
  isPreparingWorktree: boolean;
  isSendBusy: boolean;
  isVoiceRecording: boolean;
  isVoiceTranscribing: boolean;
  lockedProvider: ComponentProps<typeof ProviderModelPicker>["lockedProvider"];
  modelOptionsByProvider: ComponentProps<typeof ProviderModelPicker>["modelOptionsByProvider"];
  modelPickerIconClassName: string | undefined;
  nonPersistedComposerImageIdSet: ReadonlySet<string>;
  onAddComposerPhotos: (files: File[]) => void;
  onAdvanceActivePendingUserInput: ComponentProps<
    typeof ChatComposerStatusBanner
  >["onAdvanceActivePendingUserInput"];
  onCancelComposerVoiceRecording: () => void;
  onComposerCommandKey: NonNullable<
    ComponentProps<typeof ComposerPromptEditor>["onCommandKeyDown"]
  >;
  onComposerPaste: ComponentProps<typeof ComposerPromptEditor>["onPaste"];
  onExpandComposerImage: ComponentProps<typeof ComposerImageAttachmentChip>["onExpandImage"];
  onImplementPlanInNewThread: () => void | Promise<void>;
  onOpenPlanSidebar: () => void;
  onPreviousActivePendingUserInputQuestion: () => void;
  onPromptChange: ComponentProps<typeof ComposerPromptEditor>["onChange"];
  onProviderModelSelect: ComponentProps<typeof ProviderModelPicker>["onProviderModelChange"];
  onRemoveComposerImage: ComponentProps<typeof ComposerImageAttachmentChip>["onRemoveImage"];
  onRemoveComposerTerminalContext: ComponentProps<
    typeof ComposerPromptEditor
  >["onRemoveTerminalContext"];
  onRespondToApproval: ComponentProps<typeof ComposerPendingApprovalActions>["onRespondToApproval"];
  onSelectComposerMenuItem: ComponentProps<typeof ComposerCommandMenu>["onSelect"];
  onSetPlanMode: (enabled: boolean) => void;
  onSubmitComposerVoiceRecording: () => void | Promise<void>;
  onToggleActivePendingUserInputOption: ComponentProps<
    typeof ChatComposerStatusBanner
  >["onToggleActivePendingUserInputOption"];
  onToggleComposerMenuItemHighlighted: ComponentProps<
    typeof ComposerCommandMenu
  >["onHighlightedItemChange"];
  onToggleComposerVoiceRecording: () => void;
  onToggleFastMode: () => void;
  onToggleInteractionMode: () => void;
  onInterrupt: () => void | Promise<void>;
  pendingApprovalsCount: number;
  pendingUserInputs: ComponentProps<typeof ChatComposerStatusBanner>["pendingUserInputs"];
  phase: SessionPhase;
  planSidebarOpen: boolean;
  providerStatuses: ComponentProps<typeof ProviderModelPicker>["providers"];
  providerTraitsPicker: ReactNode;
  resolvedTheme: ComponentProps<typeof ComposerCommandMenu>["resolvedTheme"];
  respondingRequestIds: ComponentProps<typeof ChatComposerStatusBanner>["respondingRequestIds"];
  selectedModelForPicker: ComponentProps<typeof ProviderModelPicker>["model"];
  selectedProvider: ComponentProps<typeof ProviderModelPicker>["provider"];
  showPlanFollowUpPrompt: boolean;
  showVoiceNotesControl: boolean;
  supportsFastMode: boolean;
  voiceRecordingDurationLabel: string;
  voiceWaveformLevels: ComponentProps<typeof ComposerVoiceRecorderBar>["waveformLevels"];
}

interface UseChatComposerFooterBindingsResult {
  composerActivePlanCard: ReactNode;
  composerCommandMenuNode: ReactNode;
  composerFooter: ReactNode;
  composerImageAttachmentsNode: ReactNode;
  composerPromptEditorNode: ReactNode;
  composerStatusBanner: ReactNode;
}

// Keeps ChatView focused on orchestration while this helper assembles the composer surface.
export function useChatComposerFooterBindings(
  options: UseChatComposerFooterBindingsOptions,
): UseChatComposerFooterBindingsResult {
  const composerActivePlanCard = (
    <ChatActivePlanCard
      activePlan={options.activePlan && !options.planSidebarOpen ? options.activePlan : null}
      backgroundTaskCount={options.activePlanBackgroundTaskCount}
      onOpenSidebar={options.onOpenPlanSidebar}
    />
  );

  const composerStatusBanner = (
    <ChatComposerStatusBanner
      activePendingApproval={options.activePendingApproval}
      pendingApprovalsCount={options.pendingApprovalsCount}
      pendingUserInputs={options.pendingUserInputs}
      respondingRequestIds={options.respondingRequestIds}
      activePendingDraftAnswers={options.activePendingDraftAnswers}
      activePendingQuestionIndex={options.activePendingQuestionIndex}
      onToggleActivePendingUserInputOption={options.onToggleActivePendingUserInputOption}
      onAdvanceActivePendingUserInput={options.onAdvanceActivePendingUserInput}
      showPlanFollowUpPrompt={options.showPlanFollowUpPrompt}
      planTitle={options.activeProposedPlanTitle}
    />
  );

  const composerCommandMenuNode =
    options.composerMenuOpen && !options.isComposerApprovalState ? (
      <div className="absolute inset-x-0 bottom-full z-20 mb-2 px-1">
        <ComposerCommandMenu
          items={options.composerCommandMenuItems}
          resolvedTheme={options.resolvedTheme}
          isLoading={options.isComposerMenuLoading}
          triggerKind={options.composerCommandMenuTriggerKind}
          activeItemId={options.composerMenuActiveItemId}
          onHighlightedItemChange={options.onToggleComposerMenuItemHighlighted}
          onSelect={options.onSelectComposerMenuItem}
        />
      </div>
    ) : null;

  const composerImageAttachmentsNode =
    !options.isComposerApprovalState &&
    options.pendingUserInputs.length === 0 &&
    options.composerImages.length > 0 ? (
      <div className="mb-2.5 flex flex-wrap gap-2">
        {options.composerImages.map((image) => (
          <ComposerImageAttachmentChip
            key={image.id}
            image={image}
            images={options.composerImages}
            nonPersisted={options.nonPersistedComposerImageIdSet.has(image.id)}
            onExpandImage={options.onExpandComposerImage}
            onRemoveImage={options.onRemoveComposerImage}
          />
        ))}
      </div>
    ) : null;

  const composerPromptEditorNode = (
    <ComposerPromptEditor
      ref={options.composerEditorRef}
      value={options.composerPromptValue}
      cursor={options.composerCursor}
      terminalContexts={
        !options.isComposerApprovalState && options.pendingUserInputs.length === 0
          ? options.composerTerminalContexts
          : []
      }
      onRemoveTerminalContext={options.onRemoveComposerTerminalContext}
      onChange={options.onPromptChange}
      onCommandKeyDown={options.onComposerCommandKey}
      onPaste={options.onComposerPaste}
      placeholder={options.composerPromptPlaceholder}
      disabled={options.isComposerDisabled}
    />
  );

  const composerFooterLeftContent = (
    <div
      className={cn(
        "flex items-center",
        options.isVoiceRecording || options.isVoiceTranscribing
          ? "min-w-0 shrink-0 gap-1"
          : options.isComposerFooterCompact
            ? "min-w-0 flex-1 gap-1 overflow-hidden"
            : "-m-1 min-w-0 flex-1 gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:min-w-max sm:overflow-visible",
      )}
    >
      <ComposerExtrasMenu
        interactionMode={options.interactionMode}
        supportsFastMode={options.supportsFastMode}
        fastModeEnabled={options.fastModeEnabled}
        onAddPhotos={options.onAddComposerPhotos}
        onToggleFastMode={options.onToggleFastMode}
        onSetPlanMode={options.onSetPlanMode}
      />

      {!options.isVoiceRecording && !options.isVoiceTranscribing ? (
        <>
          <ProviderModelPicker
            compact={options.isComposerFooterCompact}
            provider={options.selectedProvider}
            model={options.selectedModelForPicker}
            lockedProvider={options.lockedProvider}
            modelOptionsByProvider={options.modelOptionsByProvider}
            {...(options.providerStatuses ? { providers: options.providerStatuses } : {})}
            {...(options.modelPickerIconClassName
              ? {
                  activeProviderIconClassName: options.modelPickerIconClassName,
                }
              : {})}
            onProviderModelChange={options.onProviderModelSelect}
          />

          {options.providerTraitsPicker ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 hidden h-4 sm:block" />
              {options.providerTraitsPicker}
            </>
          ) : null}

          {options.interactionMode === "plan" ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 hidden h-4 sm:block" />
              <Button
                variant="ghost"
                className="shrink-0 whitespace-nowrap px-2 text-[length:var(--app-font-size-ui-sm,11px)] sm:text-[length:var(--app-font-size-ui-sm,11px)] font-normal text-blue-400 hover:text-blue-300 sm:px-3"
                size="sm"
                type="button"
                onClick={options.onToggleInteractionMode}
                title="Plan mode — click to return to normal chat mode"
              >
                <GoTasklist className="size-3.5" />
                <span className="sr-only sm:not-sr-only">Plan</span>
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );

  const composerFooterRightContent = (
    <div
      data-chat-composer-actions="right"
      className={cn(
        "flex gap-2",
        options.isVoiceRecording || options.isVoiceTranscribing ? "items-center" : "items-end",
        options.isVoiceRecording || options.isVoiceTranscribing ? "min-w-0 flex-1" : "shrink-0",
      )}
    >
      {options.isPreparingWorktree ? (
        <span className="text-muted-foreground/70 text-xs">Preparing worktree...</span>
      ) : null}
      {options.showVoiceNotesControl &&
      (options.isVoiceRecording || options.isVoiceTranscribing) ? (
        <ComposerVoiceRecorderBar
          disabled={options.isComposerApprovalState || options.isConnecting || options.isSendBusy}
          isRecording={options.isVoiceRecording}
          isTranscribing={options.isVoiceTranscribing}
          durationLabel={options.voiceRecordingDurationLabel}
          waveformLevels={options.voiceWaveformLevels}
          onCancel={() => {
            if (options.isVoiceRecording) {
              void options.onSubmitComposerVoiceRecording();
              return;
            }
            options.onCancelComposerVoiceRecording();
          }}
          onSubmit={() => {
            void options.onSubmitComposerVoiceRecording();
          }}
        />
      ) : null}
      {options.activePendingProgress ? (
        <div className="flex items-center gap-2">
          {options.activePendingProgress.questionIndex > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={options.onPreviousActivePendingUserInputQuestion}
              disabled={options.activePendingIsResponding}
            >
              Previous
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            className="rounded-full px-4"
            disabled={
              options.activePendingIsResponding ||
              (options.activePendingProgress.isLastQuestion
                ? !options.activePendingResolvedAnswers
                : !options.activePendingProgress.canAdvance)
            }
          >
            {options.activePendingIsResponding
              ? "Submitting..."
              : options.activePendingProgress.isLastQuestion
                ? "Submit answers"
                : "Next question"}
          </Button>
        </div>
      ) : options.phase === "running" ? (
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-all duration-150 hover:scale-105 sm:h-[26px] sm:w-[26px]"
          onClick={() => void options.onInterrupt()}
          aria-label="Stop generation"
          title="Stop the current response. On Mac, press Ctrl+C to interrupt."
        >
          <span aria-hidden="true" className="block size-2 rounded-[2px] bg-current" />
        </button>
      ) : options.pendingUserInputs.length === 0 &&
        !options.isVoiceRecording &&
        !options.isVoiceTranscribing ? (
        options.showPlanFollowUpPrompt ? (
          options.composerPromptValue.trim().length > 0 ? (
            <Button
              type="submit"
              size="sm"
              className="h-9 rounded-full px-4 sm:h-8"
              disabled={options.isSendBusy || options.isConnecting}
            >
              {options.isConnecting || options.isSendBusy ? "Sending..." : "Refine"}
            </Button>
          ) : (
            <div className="flex items-center">
              <Button
                type="submit"
                size="sm"
                className="h-9 rounded-l-full rounded-r-none px-4 sm:h-8"
                disabled={options.isSendBusy || options.isConnecting}
              >
                {options.isConnecting || options.isSendBusy ? "Sending..." : "Implement"}
              </Button>
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      size="sm"
                      variant="default"
                      className="h-9 rounded-l-none rounded-r-full border-l-white/12 px-2 sm:h-8"
                      aria-label="Implementation actions"
                      disabled={options.isSendBusy || options.isConnecting}
                    />
                  }
                >
                  <ChevronDownIcon className="size-3.5" />
                </MenuTrigger>
                <MenuPopup align="end" side="top">
                  <MenuItem
                    disabled={options.isSendBusy || options.isConnecting}
                    onClick={() => void options.onImplementPlanInNewThread()}
                  >
                    Implement in a new thread
                  </MenuItem>
                </MenuPopup>
              </Menu>
            </div>
          )
        ) : (
          <>
            {options.showVoiceNotesControl ? (
              <ComposerVoiceButton
                disabled={
                  options.isComposerApprovalState || options.isConnecting || options.isSendBusy
                }
                isRecording={options.isVoiceRecording}
                isTranscribing={options.isVoiceTranscribing}
                durationLabel={options.voiceRecordingDurationLabel}
                onClick={options.onToggleComposerVoiceRecording}
              />
            ) : null}
            <button
              type="submit"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background transition-all duration-150 hover:scale-105 disabled:opacity-20 disabled:hover:scale-100 sm:h-8 sm:w-8"
              disabled={
                options.isSendBusy ||
                options.isConnecting ||
                options.isVoiceTranscribing ||
                !options.hasComposerSendableContent
              }
              aria-label={
                options.isConnecting
                  ? "Connecting"
                  : options.isVoiceTranscribing
                    ? "Transcribing voice note"
                    : options.isPreparingWorktree
                      ? "Preparing worktree"
                      : options.isSendBusy
                        ? "Sending"
                        : "Send message"
              }
            >
              {options.isConnecting || options.isSendBusy ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="animate-spin"
                  aria-hidden="true"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="20 12"
                  />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </>
        )
      ) : null}
    </div>
  );

  const composerFooter = (
    <ChatComposerFooter
      activePendingApprovalActions={
        options.activePendingApproval ? (
          <ComposerPendingApprovalActions
            requestId={options.activePendingApproval.requestId}
            isResponding={options.respondingRequestIds.includes(
              options.activePendingApproval.requestId,
            )}
            onRespondToApproval={options.onRespondToApproval}
          />
        ) : null
      }
      isComposerFooterCompact={options.isComposerFooterCompact}
      leftContent={composerFooterLeftContent}
      rightContent={composerFooterRightContent}
    />
  );

  return {
    composerActivePlanCard,
    composerCommandMenuNode,
    composerFooter,
    composerImageAttachmentsNode,
    composerPromptEditorNode,
    composerStatusBanner,
  };
}
