// FILE: useChatQueuedTurnBindings.ts
// Purpose: Own ChatView's queued-turn dispatch, plan follow-up submission, and implementation-thread launch flow.
// Layer: ChatView hook
// Depends on: Native orchestration commands plus caller-owned send/navigation/sidebar callbacks.

import {
  type ModelSelection,
  type OrchestrationReadModel,
  type ProviderInteractionMode,
  type ProviderKind,
  type ProviderStartOptions,
  RuntimeMode,
  type ThreadId,
} from "@t3tools/contracts";
import { type AssociatedWorktreeMetadata } from "@t3tools/shared/threadWorkspace";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  type QueuedComposerChatTurn,
  type QueuedComposerPlanFollowUp,
  type QueuedComposerTurn,
} from "../../composerDraftStore";
import { newCommandId, newMessageId, newThreadId } from "../../lib/utils";
import { readNativeApi } from "../../nativeApi";
import {
  buildPlanImplementationPrompt,
  buildPlanImplementationThreadTitle,
} from "../../proposedPlan";
import { truncateTitle } from "../../truncateTitle";
import type { ChatMessage, Project, ProposedPlan, Thread } from "../../types";
import { toastManager } from "../ui/toast";

interface PersistThreadSettingsInput {
  threadId: ThreadId;
  createdAt: string;
  modelSelection?: ModelSelection;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
}

interface SubmitPlanFollowUpInput {
  text: string;
  interactionMode: "default" | "plan";
  dispatchMode: "queue" | "steer";
  queuedTurn?: QueuedComposerPlanFollowUp;
}

interface UseChatQueuedTurnBindingsOptions {
  activeProject: Project | undefined;
  activeProposedPlan: ProposedPlan | null;
  activeThread: Thread | undefined;
  activeThreadAssociatedWorktree: AssociatedWorktreeMetadata;
  autoDispatchingQueuedTurnRef: MutableRefObject<boolean>;
  beginLocalDispatch: (input?: { preparingWorktree?: boolean }) => void;
  dispatchQueuedChatTurn: (
    dispatchMode: "queue" | "steer",
    queuedTurn: QueuedComposerChatTurn,
  ) => Promise<boolean>;
  forceStickToBottom: () => void;
  formatOutgoingPrompt: (input: {
    provider: ProviderKind;
    model: string | null;
    effort: string | null;
    text: string;
  }) => string;
  handleImplementationThreadOpened: (threadId: ThreadId) => Promise<void>;
  handlePlanImplementationStarted: () => void;
  hasActivePendingApproval: boolean;
  hasActivePendingProgress: boolean;
  hasLiveTurn: boolean;
  insertQueuedComposerTurn: (
    threadId: ThreadId,
    queuedTurn: QueuedComposerTurn,
    index: number,
  ) => void;
  isConnecting: boolean;
  isDisconnected: boolean;
  isSendBusy: boolean;
  isServerThread: boolean;
  pendingUserInputCount: number;
  persistThreadSettingsForNextTurn: (input: PersistThreadSettingsInput) => Promise<void>;
  providerOptionsForDispatch: ProviderStartOptions | undefined;
  queuedComposerTurns: ReadonlyArray<QueuedComposerTurn>;
  queuedComposerTurnsRef: MutableRefObject<QueuedComposerTurn[]>;
  removeQueuedComposerTurn: (queuedTurnId: string) => void;
  removeQueuedComposerTurnFromDraft: (threadId: ThreadId, queuedTurnId: string) => void;
  resetLocalDispatch: () => void;
  restoreQueuedTurnToComposer: (queuedTurn: QueuedComposerTurn) => void;
  runtimeMode: RuntimeMode;
  selectedModel: string | null;
  selectedModelSelection: ModelSelection;
  selectedPromptEffort: string | null;
  selectedProvider: ProviderKind;
  sendInFlightRef: MutableRefObject<boolean>;
  setComposerDraftInteractionMode: (threadId: ThreadId, mode: ProviderInteractionMode) => void;
  setOptimisticUserMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setThreadError: (threadId: ThreadId, error: string | null) => void;
  settingsEnableAssistantStreaming: boolean;
  syncServerReadModel: (snapshot: OrchestrationReadModel) => void;
  threadId: ThreadId;
}

interface UseChatQueuedTurnBindingsResult {
  onEditQueuedComposerTurn: (queuedTurn: QueuedComposerTurn) => void;
  onImplementPlanInNewThread: () => Promise<void>;
  onSteerQueuedComposerTurn: (queuedTurn: QueuedComposerTurn) => Promise<void>;
  submitPlanFollowUp: (input: SubmitPlanFollowUpInput) => Promise<boolean>;
}

// Keeps queued-turn orchestration together so ChatView can treat follow-up dispatch and plan implementation as one seam.
export function useChatQueuedTurnBindings(
  options: UseChatQueuedTurnBindingsOptions,
): UseChatQueuedTurnBindingsResult {
  const {
    activeProject,
    activeProposedPlan,
    activeThread,
    activeThreadAssociatedWorktree,
    autoDispatchingQueuedTurnRef,
    beginLocalDispatch,
    dispatchQueuedChatTurn,
    forceStickToBottom,
    formatOutgoingPrompt,
    handleImplementationThreadOpened,
    handlePlanImplementationStarted,
    hasActivePendingApproval,
    hasActivePendingProgress,
    hasLiveTurn,
    insertQueuedComposerTurn,
    isConnecting,
    isDisconnected,
    isSendBusy,
    isServerThread,
    pendingUserInputCount,
    persistThreadSettingsForNextTurn,
    providerOptionsForDispatch,
    queuedComposerTurns,
    queuedComposerTurnsRef,
    removeQueuedComposerTurn,
    removeQueuedComposerTurnFromDraft,
    resetLocalDispatch,
    restoreQueuedTurnToComposer,
    runtimeMode,
    selectedModel,
    selectedModelSelection,
    selectedPromptEffort,
    selectedProvider,
    sendInFlightRef,
    setComposerDraftInteractionMode,
    setOptimisticUserMessages,
    setThreadError,
    settingsEnableAssistantStreaming,
    syncServerReadModel,
    threadId,
  } = options;

  const submitPlanFollowUp = useCallback(
    async ({
      text,
      interactionMode: nextInteractionMode,
      dispatchMode,
      queuedTurn,
    }: SubmitPlanFollowUpInput): Promise<boolean> => {
      const api = readNativeApi();
      if (
        !api ||
        !activeThread ||
        !isServerThread ||
        isSendBusy ||
        isConnecting ||
        sendInFlightRef.current
      ) {
        return false;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return false;
      }

      const threadIdForSend = activeThread.id;
      const messageIdForSend = newMessageId();
      const messageCreatedAt = new Date().toISOString();
      const outgoingMessageText = formatOutgoingPrompt({
        provider: queuedTurn?.selectedProvider ?? selectedProvider,
        model: queuedTurn?.selectedModel ?? selectedModel,
        effort: queuedTurn?.selectedPromptEffort ?? selectedPromptEffort,
        text: trimmed,
      });

      sendInFlightRef.current = true;
      beginLocalDispatch();
      setThreadError(threadIdForSend, null);
      setOptimisticUserMessages((existing) => [
        ...existing,
        {
          id: messageIdForSend,
          role: "user",
          text: outgoingMessageText,
          createdAt: messageCreatedAt,
          streaming: false,
          source: "native",
        },
      ]);
      forceStickToBottom();

      try {
        await persistThreadSettingsForNextTurn({
          threadId: threadIdForSend,
          createdAt: messageCreatedAt,
          modelSelection: queuedTurn?.modelSelection ?? selectedModelSelection,
          runtimeMode: queuedTurn?.runtimeMode ?? runtimeMode,
          interactionMode: nextInteractionMode,
        });

        // Keep the mode toggle and plan-follow-up banner in sync immediately while the next turn starts.
        setComposerDraftInteractionMode(threadIdForSend, nextInteractionMode);

        await api.orchestration.dispatchCommand({
          type: "thread.turn.start",
          commandId: newCommandId(),
          threadId: threadIdForSend,
          message: {
            messageId: messageIdForSend,
            role: "user",
            text: outgoingMessageText,
            attachments: [],
          },
          modelSelection: queuedTurn?.modelSelection ?? selectedModelSelection,
          ...((queuedTurn?.providerOptionsForDispatch ?? providerOptionsForDispatch)
            ? {
                providerOptions:
                  queuedTurn?.providerOptionsForDispatch ?? providerOptionsForDispatch,
              }
            : {}),
          assistantDeliveryMode: settingsEnableAssistantStreaming ? "streaming" : "buffered",
          dispatchMode,
          runtimeMode: queuedTurn?.runtimeMode ?? runtimeMode,
          interactionMode: nextInteractionMode,
          ...(nextInteractionMode === "default" && activeProposedPlan
            ? {
                sourceProposedPlan: {
                  threadId: activeThread.id,
                  planId: activeProposedPlan.id,
                },
              }
            : {}),
          createdAt: messageCreatedAt,
        });

        if (nextInteractionMode === "default") {
          handlePlanImplementationStarted();
        }

        sendInFlightRef.current = false;
        return true;
      } catch (err) {
        setOptimisticUserMessages((existing) =>
          existing.filter((message) => message.id !== messageIdForSend),
        );
        setThreadError(
          threadIdForSend,
          err instanceof Error ? err.message : "Failed to send plan follow-up.",
        );
        sendInFlightRef.current = false;
        resetLocalDispatch();
        return false;
      }
    },
    [
      activeProposedPlan,
      activeThread,
      beginLocalDispatch,
      forceStickToBottom,
      formatOutgoingPrompt,
      handlePlanImplementationStarted,
      isConnecting,
      isSendBusy,
      isServerThread,
      persistThreadSettingsForNextTurn,
      providerOptionsForDispatch,
      resetLocalDispatch,
      runtimeMode,
      selectedModel,
      selectedModelSelection,
      selectedPromptEffort,
      selectedProvider,
      sendInFlightRef,
      setComposerDraftInteractionMode,
      setOptimisticUserMessages,
      setThreadError,
      settingsEnableAssistantStreaming,
    ],
  );

  const dispatchQueuedChatTurnRef = useRef(dispatchQueuedChatTurn);
  const submitPlanFollowUpRef = useRef(submitPlanFollowUp);
  dispatchQueuedChatTurnRef.current = dispatchQueuedChatTurn;
  submitPlanFollowUpRef.current = submitPlanFollowUp;

  const dispatchQueuedComposerTurn = useCallback(
    async (queuedTurn: QueuedComposerTurn, dispatchMode: "queue" | "steer"): Promise<boolean> => {
      if (queuedTurn.kind === "chat") {
        return dispatchQueuedChatTurnRef.current(dispatchMode, queuedTurn);
      }
      return submitPlanFollowUpRef.current({
        text: queuedTurn.text,
        interactionMode: queuedTurn.interactionMode,
        dispatchMode,
        queuedTurn,
      });
    },
    [],
  );

  const onSteerQueuedComposerTurn = useCallback(
    async (queuedTurn: QueuedComposerTurn) => {
      const previousQueue = queuedComposerTurnsRef.current;
      const queuedIndex = previousQueue.findIndex((entry) => entry.id === queuedTurn.id);
      if (queuedIndex < 0) {
        return;
      }
      removeQueuedComposerTurnFromDraft(threadId, queuedTurn.id);
      const succeeded = await dispatchQueuedComposerTurn(queuedTurn, "steer");
      if (succeeded) {
        return;
      }
      insertQueuedComposerTurn(threadId, queuedTurn, queuedIndex);
    },
    [
      dispatchQueuedComposerTurn,
      insertQueuedComposerTurn,
      queuedComposerTurnsRef,
      removeQueuedComposerTurnFromDraft,
      threadId,
    ],
  );

  const onEditQueuedComposerTurn = useCallback(
    (queuedTurn: QueuedComposerTurn) => {
      removeQueuedComposerTurn(queuedTurn.id);
      restoreQueuedTurnToComposer(queuedTurn);
    },
    [removeQueuedComposerTurn, restoreQueuedTurnToComposer],
  );

  useEffect(() => {
    if (autoDispatchingQueuedTurnRef.current) {
      return;
    }
    if (
      hasLiveTurn ||
      isDisconnected ||
      isSendBusy ||
      isConnecting ||
      sendInFlightRef.current ||
      hasActivePendingApproval ||
      hasActivePendingProgress ||
      pendingUserInputCount > 0 ||
      queuedComposerTurns.length === 0
    ) {
      return;
    }

    const nextQueuedTurn = queuedComposerTurns[0];
    if (!nextQueuedTurn) {
      return;
    }

    autoDispatchingQueuedTurnRef.current = true;
    void (async () => {
      try {
        const succeeded = await dispatchQueuedComposerTurn(nextQueuedTurn, "queue");
        if (succeeded) {
          removeQueuedComposerTurnFromDraft(threadId, nextQueuedTurn.id);
        }
      } finally {
        autoDispatchingQueuedTurnRef.current = false;
      }
    })();
  }, [
    autoDispatchingQueuedTurnRef,
    dispatchQueuedComposerTurn,
    hasActivePendingApproval,
    hasActivePendingProgress,
    hasLiveTurn,
    isConnecting,
    isDisconnected,
    isSendBusy,
    pendingUserInputCount,
    queuedComposerTurns,
    removeQueuedComposerTurnFromDraft,
    sendInFlightRef,
    threadId,
  ]);

  const onImplementPlanInNewThread = useCallback(async () => {
    const api = readNativeApi();
    if (
      !api ||
      !activeThread ||
      !activeProject ||
      !activeProposedPlan ||
      !isServerThread ||
      isSendBusy ||
      isConnecting ||
      sendInFlightRef.current
    ) {
      return;
    }

    const createdAt = new Date().toISOString();
    const nextThreadId = newThreadId();
    const planMarkdown = activeProposedPlan.planMarkdown;
    const implementationPrompt = buildPlanImplementationPrompt(planMarkdown);
    const outgoingImplementationPrompt = formatOutgoingPrompt({
      provider: selectedProvider,
      model: selectedModel,
      effort: selectedPromptEffort,
      text: implementationPrompt,
    });
    const nextThreadTitle = truncateTitle(buildPlanImplementationThreadTitle(planMarkdown));
    const nextThreadModelSelection: ModelSelection = selectedModelSelection;

    sendInFlightRef.current = true;
    beginLocalDispatch();
    const finish = () => {
      sendInFlightRef.current = false;
      resetLocalDispatch();
    };

    await api.orchestration
      .dispatchCommand({
        type: "thread.create",
        commandId: newCommandId(),
        threadId: nextThreadId,
        projectId: activeProject.id,
        title: nextThreadTitle,
        modelSelection: nextThreadModelSelection,
        runtimeMode,
        interactionMode: "default",
        envMode: activeThread.envMode ?? (activeThread.worktreePath ? "worktree" : "local"),
        branch: activeThread.branch,
        worktreePath: activeThread.worktreePath,
        associatedWorktreePath: activeThreadAssociatedWorktree.associatedWorktreePath,
        associatedWorktreeBranch: activeThreadAssociatedWorktree.associatedWorktreeBranch,
        associatedWorktreeRef: activeThreadAssociatedWorktree.associatedWorktreeRef,
        createdAt,
      })
      .then(() =>
        api.orchestration.dispatchCommand({
          type: "thread.turn.start",
          commandId: newCommandId(),
          threadId: nextThreadId,
          message: {
            messageId: newMessageId(),
            role: "user",
            text: outgoingImplementationPrompt,
            attachments: [],
          },
          modelSelection: selectedModelSelection,
          ...(providerOptionsForDispatch ? { providerOptions: providerOptionsForDispatch } : {}),
          assistantDeliveryMode: settingsEnableAssistantStreaming ? "streaming" : "buffered",
          dispatchMode: "queue",
          runtimeMode,
          interactionMode: "default",
          createdAt,
        }),
      )
      .then(() => api.orchestration.getSnapshot())
      .then((snapshot) => {
        syncServerReadModel(snapshot);
        return handleImplementationThreadOpened(nextThreadId);
      })
      .catch(async (err) => {
        await api.orchestration
          .dispatchCommand({
            type: "thread.delete",
            commandId: newCommandId(),
            threadId: nextThreadId,
          })
          .catch(() => undefined);
        await api.orchestration
          .getSnapshot()
          .then((snapshot) => {
            syncServerReadModel(snapshot);
          })
          .catch(() => undefined);
        toastManager.add({
          type: "error",
          title: "Could not start implementation thread",
          description:
            err instanceof Error ? err.message : "An error occurred while creating the new thread.",
        });
      })
      .then(finish, finish);
  }, [
    activeProject,
    activeProposedPlan,
    activeThread,
    activeThreadAssociatedWorktree,
    beginLocalDispatch,
    formatOutgoingPrompt,
    handleImplementationThreadOpened,
    isConnecting,
    isSendBusy,
    isServerThread,
    providerOptionsForDispatch,
    resetLocalDispatch,
    runtimeMode,
    selectedModel,
    selectedModelSelection,
    selectedPromptEffort,
    selectedProvider,
    sendInFlightRef,
    settingsEnableAssistantStreaming,
    syncServerReadModel,
  ]);

  return {
    onEditQueuedComposerTurn,
    onImplementPlanInNewThread,
    onSteerQueuedComposerTurn,
    submitPlanFollowUp,
  };
}
