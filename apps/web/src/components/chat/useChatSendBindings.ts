// FILE: useChatSendBindings.ts
// Purpose: Own ChatView's queued-turn restore and live composer send/queue flow.
// Layer: ChatView hook
// Depends on: composer draft setters, queued-turn persistence, and turn dispatch helpers.

import {
  type ModelSelection,
  type ProviderInteractionMode,
  type ProviderKind,
  type ProviderMentionReference,
  type ProviderSkillReference,
  type ProviderStartOptions,
  type ThreadId,
  RuntimeMode,
} from "@t3tools/contracts";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";

import {
  type ComposerTrigger,
  collapseExpandedComposerCursor,
  detectComposerTrigger,
} from "../../composer-logic";
import {
  type ComposerImageAttachment,
  type DraftThreadEnvMode,
  type QueuedComposerChatTurn,
  type QueuedComposerPlanFollowUp,
  type QueuedComposerTurn,
} from "../../composerDraftStore";
import { formatTerminalContextLabel, type TerminalContextDraft } from "../../lib/terminalContext";
import { randomUUID } from "../../lib/utils";
import { readNativeApi } from "../../nativeApi";
import { resolvePlanFollowUpSubmission } from "../../proposedPlan";
import { type Project, type ProposedPlan, type Thread } from "../../types";
import { type ComposerPromptEditorHandle } from "../ComposerPromptEditor";
import {
  buildExpiredTerminalContextToastCopy,
  cloneComposerImageForRetry,
  deriveComposerSendState,
  readFileAsDataUrl,
} from "../ChatView.logic";
import { toastManager } from "../ui/toast";
import { type DispatchChatTurnInput } from "./useChatTurnDispatchBindings";

type PreventDefaultEvent = { preventDefault: () => void };

type SubmitPlanFollowUpHandler = (input: {
  text: string;
  interactionMode: "default" | "plan";
  dispatchMode: "queue" | "steer";
  queuedTurn?: QueuedComposerPlanFollowUp;
}) => Promise<boolean>;

const buildQueuedComposerPreviewText = (input: {
  trimmedPrompt: string;
  images: ReadonlyArray<ComposerImageAttachment>;
  terminalContexts: ReadonlyArray<TerminalContextDraft>;
}): string => {
  if (input.trimmedPrompt.length > 0) {
    return input.trimmedPrompt;
  }
  const firstImage = input.images[0];
  if (firstImage) {
    return `Image: ${firstImage.name}`;
  }
  const firstTerminalContext = input.terminalContexts[0];
  if (firstTerminalContext) {
    return formatTerminalContextLabel(firstTerminalContext);
  }
  return "Queued follow-up";
};

interface UseChatSendBindingsOptions {
  activeProject: Project | undefined;
  activeProposedPlan: ProposedPlan | null;
  activeThread: Thread | undefined;
  addComposerImagesToDraft: (images: ComposerImageAttachment[]) => void;
  addComposerTerminalContextsToDraft: (contexts: TerminalContextDraft[]) => void;
  clearComposerDraftContent: (threadId: ThreadId) => void;
  clearComposerInput: (threadId: ThreadId) => void;
  composerEditorRef: MutableRefObject<ComposerPromptEditorHandle | null>;
  composerImages: ComposerImageAttachment[];
  composerTerminalContexts: TerminalContextDraft[];
  dispatchChatTurn: (input: DispatchChatTurnInput) => Promise<boolean>;
  enqueueQueuedComposerTurn: (threadId: ThreadId, queuedTurn: QueuedComposerTurn) => void;
  envMode: DraftThreadEnvMode;
  handleStandaloneSlashCommandRef: MutableRefObject<((text: string) => Promise<boolean>) | null>;
  hasActivePendingProgress: boolean;
  hasLiveTurn: boolean;
  hasNativeUserMessages: boolean;
  interactionMode: ProviderInteractionMode;
  isConnecting: boolean;
  isSendBusy: boolean;
  isServerThread: boolean;
  isVoiceTranscribing: boolean;
  onAdvanceActivePendingUserInput: () => void;
  promptRef: MutableRefObject<string>;
  providerOptionsForDispatch: ProviderStartOptions | undefined;
  removeQueuedComposerTurnFromDraft: (threadId: ThreadId, queuedTurnId: string) => void;
  runtimeMode: RuntimeMode;
  scheduleComposerFocus: () => void;
  selectedComposerMentions: ProviderMentionReference[];
  selectedComposerSkills: ProviderSkillReference[];
  selectedModel: string | null;
  selectedModelSelection: ModelSelection;
  selectedPromptEffort: string | null;
  selectedProvider: ProviderKind;
  sendInFlightRef: MutableRefObject<boolean>;
  setComposerCursor: (cursor: number) => void;
  setComposerDraftInteractionMode: (threadId: ThreadId, mode: ProviderInteractionMode) => void;
  setComposerDraftModelSelection: (threadId: ThreadId, modelSelection: ModelSelection) => void;
  setComposerDraftPrompt: (threadId: ThreadId, prompt: string) => void;
  setComposerDraftRuntimeMode: (threadId: ThreadId, mode: RuntimeMode) => void;
  setComposerTrigger: (trigger: ComposerTrigger | null) => void;
  setDraftThreadContext: (
    threadId: ThreadId,
    next: {
      runtimeMode: RuntimeMode;
      interactionMode: ProviderInteractionMode;
      envMode?: DraftThreadEnvMode;
    },
  ) => void;
  setSelectedComposerMentions: Dispatch<SetStateAction<ProviderMentionReference[]>>;
  setSelectedComposerSkills: Dispatch<SetStateAction<ProviderSkillReference[]>>;
  setStoreThreadError: (threadId: ThreadId, error: string | null) => void;
  showPlanFollowUpPrompt: boolean;
  submitPlanFollowUpRef: MutableRefObject<SubmitPlanFollowUpHandler | null>;
  threadId: ThreadId;
}

interface UseChatSendBindingsResult {
  dispatchQueuedChatTurn: (
    dispatchMode: "queue" | "steer",
    queuedTurn: QueuedComposerChatTurn,
  ) => Promise<boolean>;
  onSend: (
    e?: PreventDefaultEvent,
    dispatchMode?: "queue" | "steer",
    queuedTurn?: QueuedComposerChatTurn,
  ) => Promise<boolean>;
  removeQueuedComposerTurn: (queuedTurnId: string) => void;
  restoreQueuedTurnToComposer: (queuedTurn: QueuedComposerTurn) => void;
}

// Keeps the live send path and queued-turn restore logic together so ChatView does not own another large dispatch block inline.
export function useChatSendBindings(
  options: UseChatSendBindingsOptions,
): UseChatSendBindingsResult {
  const {
    activeProject,
    activeProposedPlan,
    activeThread,
    addComposerImagesToDraft,
    addComposerTerminalContextsToDraft,
    clearComposerDraftContent,
    clearComposerInput,
    composerEditorRef,
    composerImages,
    composerTerminalContexts,
    dispatchChatTurn,
    enqueueQueuedComposerTurn,
    envMode,
    handleStandaloneSlashCommandRef,
    hasActivePendingProgress,
    hasLiveTurn,
    hasNativeUserMessages,
    interactionMode,
    isConnecting,
    isSendBusy,
    isServerThread,
    isVoiceTranscribing,
    onAdvanceActivePendingUserInput,
    promptRef,
    providerOptionsForDispatch,
    removeQueuedComposerTurnFromDraft,
    runtimeMode,
    scheduleComposerFocus,
    selectedComposerMentions,
    selectedComposerSkills,
    selectedModel,
    selectedModelSelection,
    selectedPromptEffort,
    selectedProvider,
    sendInFlightRef,
    setComposerCursor,
    setComposerDraftInteractionMode,
    setComposerDraftModelSelection,
    setComposerDraftPrompt,
    setComposerDraftRuntimeMode,
    setComposerTrigger,
    setDraftThreadContext,
    setSelectedComposerMentions,
    setSelectedComposerSkills,
    setStoreThreadError,
    showPlanFollowUpPrompt,
    submitPlanFollowUpRef,
    threadId,
  } = options;

  const restoreQueuedTurnToComposer = useCallback(
    (queuedTurn: QueuedComposerTurn) => {
      if (!activeThread) {
        return;
      }
      const nextPrompt = queuedTurn.kind === "chat" ? queuedTurn.prompt : queuedTurn.text;
      const restoredImages =
        queuedTurn.kind === "chat" ? queuedTurn.images.map(cloneComposerImageForRetry) : [];
      promptRef.current = nextPrompt;
      clearComposerDraftContent(activeThread.id);
      setComposerDraftPrompt(activeThread.id, nextPrompt);
      setDraftThreadContext(activeThread.id, {
        runtimeMode: queuedTurn.runtimeMode,
        interactionMode: queuedTurn.interactionMode,
        ...(queuedTurn.kind === "chat" ? { envMode: queuedTurn.envMode } : {}),
      });
      if (queuedTurn.kind === "chat") {
        if (restoredImages.length > 0) {
          addComposerImagesToDraft(restoredImages);
        }
        if (queuedTurn.terminalContexts.length > 0) {
          addComposerTerminalContextsToDraft(queuedTurn.terminalContexts);
        }
        setSelectedComposerSkills(queuedTurn.skills);
        setSelectedComposerMentions(queuedTurn.mentions);
      } else {
        setSelectedComposerSkills([]);
        setSelectedComposerMentions([]);
      }
      setComposerDraftModelSelection(activeThread.id, queuedTurn.modelSelection);
      setComposerDraftRuntimeMode(activeThread.id, queuedTurn.runtimeMode);
      setComposerDraftInteractionMode(activeThread.id, queuedTurn.interactionMode);
      setComposerCursor(collapseExpandedComposerCursor(nextPrompt, nextPrompt.length));
      setComposerTrigger(detectComposerTrigger(nextPrompt, nextPrompt.length));
      scheduleComposerFocus();
    },
    [
      activeThread,
      addComposerImagesToDraft,
      addComposerTerminalContextsToDraft,
      clearComposerDraftContent,
      promptRef,
      scheduleComposerFocus,
      setComposerCursor,
      setComposerDraftInteractionMode,
      setComposerDraftModelSelection,
      setComposerDraftPrompt,
      setComposerDraftRuntimeMode,
      setComposerTrigger,
      setDraftThreadContext,
      setSelectedComposerMentions,
      setSelectedComposerSkills,
    ],
  );

  const removeQueuedComposerTurn = useCallback(
    (queuedTurnId: string) => {
      removeQueuedComposerTurnFromDraft(threadId, queuedTurnId);
    },
    [removeQueuedComposerTurnFromDraft, threadId],
  );

  const onSend = useCallback(
    async (
      e?: PreventDefaultEvent,
      dispatchMode: "queue" | "steer" = "queue",
      queuedTurn?: QueuedComposerChatTurn,
    ): Promise<boolean> => {
      e?.preventDefault();
      const api = readNativeApi();
      if (
        !api ||
        !activeThread ||
        isSendBusy ||
        isConnecting ||
        isVoiceTranscribing ||
        sendInFlightRef.current
      ) {
        return false;
      }
      if (hasActivePendingProgress) {
        onAdvanceActivePendingUserInput();
        return true;
      }

      const queuedChatTurn = queuedTurn ?? null;
      const liveComposerSnapshot =
        queuedChatTurn === null ? (composerEditorRef.current?.readSnapshot() ?? null) : null;
      const promptForSend =
        queuedChatTurn?.prompt ?? liveComposerSnapshot?.value ?? promptRef.current;
      const composerImagesForSend = queuedChatTurn?.images ?? composerImages;
      const composerTerminalContextsForSend =
        queuedChatTurn?.terminalContexts ?? composerTerminalContexts;
      const selectedComposerSkillsForSend = queuedChatTurn?.skills ?? selectedComposerSkills;
      const selectedComposerMentionsForSend = queuedChatTurn?.mentions ?? selectedComposerMentions;
      const selectedProviderForSend = queuedChatTurn?.selectedProvider ?? selectedProvider;
      const selectedModelForSend = queuedChatTurn?.selectedModel ?? selectedModel;
      const selectedPromptEffortForSend =
        queuedChatTurn?.selectedPromptEffort ?? selectedPromptEffort;
      const selectedModelSelectionForSend =
        queuedChatTurn?.modelSelection ?? selectedModelSelection;
      const providerOptionsForDispatchForSend =
        queuedChatTurn?.providerOptionsForDispatch ?? providerOptionsForDispatch;
      const runtimeModeForSend = queuedChatTurn?.runtimeMode ?? runtimeMode;
      const interactionModeForSend = queuedChatTurn?.interactionMode ?? interactionMode;
      const envModeForSend = queuedChatTurn?.envMode ?? envMode;
      const {
        trimmedPrompt: trimmed,
        sendableTerminalContexts: sendableComposerTerminalContexts,
        expiredTerminalContextCount,
        hasSendableContent,
      } = deriveComposerSendState({
        prompt: promptForSend,
        imageCount: composerImagesForSend.length,
        terminalContexts: composerTerminalContextsForSend,
      });

      if (showPlanFollowUpPrompt && activeProposedPlan) {
        const followUp = resolvePlanFollowUpSubmission({
          draftText: trimmed,
          planMarkdown: activeProposedPlan.planMarkdown,
        });
        if (hasLiveTurn && dispatchMode === "queue" && queuedChatTurn === null) {
          clearComposerInput(activeThread.id);
          enqueueQueuedComposerTurn(activeThread.id, {
            id: randomUUID(),
            kind: "plan-follow-up",
            createdAt: new Date().toISOString(),
            previewText: followUp.text.trim(),
            text: followUp.text,
            interactionMode: followUp.interactionMode,
            selectedProvider,
            selectedModel,
            selectedPromptEffort,
            modelSelection: selectedModelSelection,
            ...(providerOptionsForDispatch ? { providerOptionsForDispatch } : {}),
            runtimeMode,
          });
          return true;
        }
        clearComposerInput(activeThread.id);
        return (
          (await submitPlanFollowUpRef.current?.({
            text: followUp.text,
            interactionMode: followUp.interactionMode,
            dispatchMode,
          })) ?? false
        );
      }

      if (composerImagesForSend.length === 0 && sendableComposerTerminalContexts.length === 0) {
        const handledSlashCommand = await handleStandaloneSlashCommandRef.current?.(trimmed);
        if (handledSlashCommand) {
          return true;
        }
      }

      if (!hasSendableContent) {
        if (expiredTerminalContextCount > 0) {
          const toastCopy = buildExpiredTerminalContextToastCopy(
            expiredTerminalContextCount,
            "empty",
          );
          toastManager.add({
            type: "warning",
            title: toastCopy.title,
            description: toastCopy.description,
          });
        }
        return false;
      }

      if (!activeProject) {
        return false;
      }

      if (hasLiveTurn && dispatchMode === "queue" && queuedChatTurn === null) {
        clearComposerInput(activeThread.id);
        const queuedImagesForPersistence = await Promise.all(
          composerImagesForSend.map(async (image) => {
            try {
              return {
                ...image,
                previewUrl: await readFileAsDataUrl(image.file),
              };
            } catch {
              return image;
            }
          }),
        );
        enqueueQueuedComposerTurn(activeThread.id, {
          id: randomUUID(),
          kind: "chat",
          createdAt: new Date().toISOString(),
          previewText: buildQueuedComposerPreviewText({
            trimmedPrompt: trimmed,
            images: queuedImagesForPersistence,
            terminalContexts: sendableComposerTerminalContexts,
          }),
          prompt: promptForSend,
          images: queuedImagesForPersistence,
          terminalContexts: sendableComposerTerminalContexts,
          skills: selectedComposerSkillsForSend,
          mentions: selectedComposerMentionsForSend,
          selectedProvider: selectedProviderForSend,
          selectedModel: selectedModelForSend,
          selectedPromptEffort: selectedPromptEffortForSend,
          modelSelection: selectedModelSelectionForSend,
          ...(providerOptionsForDispatchForSend
            ? { providerOptionsForDispatch: providerOptionsForDispatchForSend }
            : {}),
          runtimeMode: runtimeModeForSend,
          interactionMode: interactionModeForSend,
          envMode: envModeForSend,
        });
        return true;
      }

      const isFirstMessage = !isServerThread || !hasNativeUserMessages;
      const baseBranchForWorktree =
        isFirstMessage && envModeForSend === "worktree" && !activeThread.worktreePath
          ? activeThread.branch
          : null;
      const shouldCreateWorktree =
        isFirstMessage && envModeForSend === "worktree" && !activeThread.worktreePath;
      if (shouldCreateWorktree && !activeThread.branch) {
        setStoreThreadError(
          activeThread.id,
          "Select a base branch before sending in New worktree mode.",
        );
        return false;
      }

      return dispatchChatTurn({
        activeProject,
        baseBranchForWorktree,
        composerImagesForSend,
        composerMentionsForSend: selectedComposerMentionsForSend,
        composerSkillsForSend: selectedComposerSkillsForSend,
        composerTerminalContextsForSend: sendableComposerTerminalContexts,
        dispatchMode,
        envModeForSend,
        expiredTerminalContextCount,
        interactionModeForSend,
        promptForSend,
        queuedChatTurn,
        runtimeModeForSend,
        selectedModelForSend,
        selectedModelSelectionForSend,
        selectedPromptEffortForSend,
        selectedProviderForSend,
        providerOptionsForDispatchForSend,
        trimmedPrompt: trimmed,
      });
    },
    [
      activeProject,
      activeProposedPlan,
      activeThread,
      clearComposerInput,
      composerEditorRef,
      composerImages,
      composerTerminalContexts,
      dispatchChatTurn,
      enqueueQueuedComposerTurn,
      envMode,
      handleStandaloneSlashCommandRef,
      hasActivePendingProgress,
      hasLiveTurn,
      hasNativeUserMessages,
      interactionMode,
      isConnecting,
      isSendBusy,
      isServerThread,
      isVoiceTranscribing,
      onAdvanceActivePendingUserInput,
      promptRef,
      providerOptionsForDispatch,
      runtimeMode,
      selectedComposerMentions,
      selectedComposerSkills,
      selectedModel,
      selectedModelSelection,
      selectedPromptEffort,
      selectedProvider,
      sendInFlightRef,
      setStoreThreadError,
      showPlanFollowUpPrompt,
      submitPlanFollowUpRef,
    ],
  );

  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  const dispatchQueuedChatTurn = useCallback(
    async (dispatchMode: "queue" | "steer", queuedTurn: QueuedComposerChatTurn) =>
      onSendRef.current(undefined, dispatchMode, queuedTurn),
    [],
  );

  return {
    dispatchQueuedChatTurn,
    onSend,
    removeQueuedComposerTurn,
    restoreQueuedTurnToComposer,
  };
}
