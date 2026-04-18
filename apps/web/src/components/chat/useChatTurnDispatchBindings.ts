// FILE: useChatTurnDispatchBindings.ts
// Purpose: Own ChatView's local-dispatch, interrupt, and turn-start dispatch flow.
// Layer: ChatView hook
// Depends on: Native orchestration commands plus caller-owned composer/project helpers.

import {
  DEFAULT_MODEL_BY_PROVIDER,
  type ModelSelection,
  type ProjectScript,
  type ProviderInteractionMode,
  type ProviderKind,
  type ProviderMentionReference,
  type ProviderSkillReference,
  type ProviderStartOptions,
  type ThreadId,
  RuntimeMode,
} from "@t3tools/contracts";
import { buildTemporaryWorktreeBranchName } from "@t3tools/shared/git";
import {
  buildPromptThreadTitleFallback,
  GENERIC_CHAT_THREAD_TITLE,
} from "@t3tools/shared/chatThreads";
import { deriveAssociatedWorktreeMetadata } from "@t3tools/shared/threadWorkspace";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
} from "react";

import {
  type ComposerImageAttachment,
  type DraftThreadEnvMode,
  type QueuedComposerChatTurn,
} from "../../composerDraftStore";
import {
  appendTerminalContextsToPrompt,
  IMAGE_ONLY_BOOTSTRAP_PROMPT,
  formatTerminalContextLabel,
  type TerminalContextDraft,
} from "../../lib/terminalContext";
import { newCommandId, newMessageId } from "../../lib/utils";
import { readNativeApi } from "../../nativeApi";
import { type ChatMessage, type Project, type Thread } from "../../types";
import {
  buildExpiredTerminalContextToastCopy,
  cloneComposerImageForRetry,
  createLocalDispatchSnapshot,
  type LocalDispatchSnapshot,
  readFileAsDataUrl,
  revokeUserMessagePreviewUrls,
} from "../ChatView.logic";
import { toastManager } from "../ui/toast";
import { setupProjectScript } from "../../projectScripts";

interface PersistThreadSettingsInput {
  threadId: ThreadId;
  createdAt: string;
  modelSelection?: ModelSelection;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
}

interface CreateWorktreeResult {
  worktree: {
    branch: string;
    path: string;
  };
}

interface RunProjectScriptOptions {
  cwd?: string;
  worktreePath?: string | null;
  rememberAsLastInvoked?: boolean;
}

interface RestoreFailedComposerSendDraftInput {
  prompt: string;
  images: ComposerImageAttachment[];
  terminalContexts: TerminalContextDraft[];
  skills: ProviderSkillReference[];
  mentions: ProviderMentionReference[];
}

interface DispatchChatTurnInput {
  activeProject: Project;
  baseBranchForWorktree: string | null;
  composerImagesForSend: ComposerImageAttachment[];
  composerMentionsForSend: ProviderMentionReference[];
  composerSkillsForSend: ProviderSkillReference[];
  composerTerminalContextsForSend: TerminalContextDraft[];
  dispatchMode: "queue" | "steer";
  envModeForSend: DraftThreadEnvMode;
  expiredTerminalContextCount: number;
  interactionModeForSend: ProviderInteractionMode;
  promptForSend: string;
  queuedChatTurn: QueuedComposerChatTurn | null;
  runtimeModeForSend: RuntimeMode;
  selectedModelForSend: string | null;
  selectedModelSelectionForSend: ModelSelection;
  selectedPromptEffortForSend: string | null;
  selectedProviderForSend: ProviderKind;
  providerOptionsForDispatchForSend: ProviderStartOptions | undefined;
  trimmedPrompt: string;
}

interface ThreadWorkspacePatch {
  branch: string | null;
  worktreePath: string | null;
  associatedWorktreePath?: string | null;
  associatedWorktreeBranch?: string | null;
  associatedWorktreeRef?: string | null;
}

interface UseChatTurnDispatchBindingsOptions {
  activeThread: Thread | undefined;
  clearComposerInput: (threadId: ThreadId) => void;
  composerImagesRef: MutableRefObject<ComposerImageAttachment[]>;
  composerTerminalContextsRef: MutableRefObject<TerminalContextDraft[]>;
  createWorktree: (input: {
    cwd: string;
    branch: string;
    newBranch: string;
  }) => Promise<CreateWorktreeResult>;
  forceStickToBottom: () => void;
  formatOutgoingPrompt: (input: {
    provider: ProviderKind;
    model: string | null;
    effort: string | null;
    text: string;
  }) => string;
  isConnecting: boolean;
  isLocalDraftThread: boolean;
  isSendBusy: boolean;
  isServerThread: boolean;
  persistThreadSettingsForNextTurn: (input: PersistThreadSettingsInput) => Promise<void>;
  promptIncludesSkillMention: (
    prompt: string,
    skillName: string,
    provider: ProviderKind,
  ) => boolean;
  promptRef: MutableRefObject<string>;
  resolvePromptPluginMentions: (input: {
    prompt: string;
    existingMentions: readonly ProviderMentionReference[];
  }) => ProviderMentionReference[];
  restoreFailedComposerSendDraft: (input: RestoreFailedComposerSendDraftInput) => void;
  runProjectScript: (script: ProjectScript, options?: RunProjectScriptOptions) => Promise<void>;
  sendInFlightRef: MutableRefObject<boolean>;
  serverAcknowledgedLocalDispatch: boolean;
  setLocalDispatch: Dispatch<SetStateAction<LocalDispatchSnapshot | null>>;
  setOptimisticUserMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStoreThreadWorkspace: (threadId: ThreadId, patch: ThreadWorkspacePatch) => void;
  setThreadError: (threadId: ThreadId, error: string | null) => void;
  settingsEnableAssistantStreaming: boolean;
}

interface UseChatTurnDispatchBindingsResult {
  beginLocalDispatch: (input?: { preparingWorktree?: boolean }) => void;
  dispatchChatTurn: (input: DispatchChatTurnInput) => Promise<boolean>;
  onInterrupt: () => Promise<void>;
  resetLocalDispatch: () => void;
}

// Owns the async turn-start path so ChatView can focus on special-case send routing instead of low-level orchestration.
export function useChatTurnDispatchBindings(
  options: UseChatTurnDispatchBindingsOptions,
): UseChatTurnDispatchBindingsResult {
  const {
    activeThread,
    clearComposerInput,
    composerImagesRef,
    composerTerminalContextsRef,
    createWorktree,
    forceStickToBottom,
    formatOutgoingPrompt,
    isConnecting,
    isLocalDraftThread,
    isSendBusy,
    isServerThread,
    persistThreadSettingsForNextTurn,
    promptIncludesSkillMention,
    promptRef,
    resolvePromptPluginMentions,
    restoreFailedComposerSendDraft,
    runProjectScript,
    sendInFlightRef,
    serverAcknowledgedLocalDispatch,
    setLocalDispatch,
    setOptimisticUserMessages,
    setStoreThreadWorkspace,
    setThreadError,
    settingsEnableAssistantStreaming,
  } = options;

  const beginLocalDispatch = useCallback(
    (input?: { preparingWorktree?: boolean }) => {
      const preparingWorktree = Boolean(input?.preparingWorktree);
      setLocalDispatch((current) => {
        if (current) {
          return current.preparingWorktree === preparingWorktree
            ? current
            : { ...current, preparingWorktree };
        }
        return createLocalDispatchSnapshot(activeThread, input);
      });
    },
    [activeThread, setLocalDispatch],
  );

  const resetLocalDispatch = useCallback(() => {
    setLocalDispatch(null);
  }, [setLocalDispatch]);

  useEffect(() => {
    if (!serverAcknowledgedLocalDispatch) {
      return;
    }
    resetLocalDispatch();
  }, [resetLocalDispatch, serverAcknowledgedLocalDispatch]);

  const onInterrupt = useCallback(async () => {
    const api = readNativeApi();
    if (
      !api ||
      !isServerThread ||
      !activeThread ||
      activeThread.session === null ||
      activeThread.session.status === "closed"
    ) {
      return;
    }

    await api.orchestration.dispatchCommand({
      type: "thread.turn.interrupt",
      commandId: newCommandId(),
      threadId: activeThread.id,
      createdAt: new Date().toISOString(),
    });
  }, [activeThread, isServerThread]);

  const dispatchChatTurn = useCallback(
    async ({
      activeProject,
      baseBranchForWorktree,
      composerImagesForSend,
      composerMentionsForSend,
      composerSkillsForSend,
      composerTerminalContextsForSend,
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
      trimmedPrompt,
    }: DispatchChatTurnInput): Promise<boolean> => {
      const api = readNativeApi();
      if (!api || !activeThread || isSendBusy || isConnecting || sendInFlightRef.current) {
        return false;
      }

      const threadIdForSend = activeThread.id;
      sendInFlightRef.current = true;
      beginLocalDispatch({ preparingWorktree: Boolean(baseBranchForWorktree) });

      const composerImagesSnapshot = [...composerImagesForSend];
      const composerTerminalContextsSnapshot = [...composerTerminalContextsForSend];
      const composerSkillsSnapshot = [...composerSkillsForSend];
      const composerMentionsSnapshot = [...composerMentionsForSend];
      const messageTextForSend = appendTerminalContextsToPrompt(
        promptForSend,
        composerTerminalContextsSnapshot,
      );
      const messageIdForSend = newMessageId();
      const messageCreatedAt = new Date().toISOString();
      const outgoingMessageText = formatOutgoingPrompt({
        provider: selectedProviderForSend,
        model: selectedModelForSend,
        effort: selectedPromptEffortForSend,
        text: messageTextForSend || IMAGE_ONLY_BOOTSTRAP_PROMPT,
      });
      const mentionedSkillsForSend = composerSkillsSnapshot.filter((skill) =>
        promptIncludesSkillMention(outgoingMessageText, skill.name, selectedProviderForSend),
      );
      const mentionedPluginMentionsForSend = resolvePromptPluginMentions({
        prompt: outgoingMessageText,
        existingMentions: composerMentionsSnapshot,
      });
      const turnAttachmentsPromise = Promise.all(
        composerImagesSnapshot.map(async (image) => ({
          type: "image" as const,
          name: image.name,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          dataUrl: await readFileAsDataUrl(image.file),
        })),
      );
      const optimisticAttachments = composerImagesSnapshot.map((image) => ({
        type: "image" as const,
        id: image.id,
        name: image.name,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        previewUrl: image.previewUrl,
      }));

      setOptimisticUserMessages((existing) => [
        ...existing,
        {
          id: messageIdForSend,
          role: "user",
          text: outgoingMessageText,
          ...(optimisticAttachments.length > 0 ? { attachments: optimisticAttachments } : {}),
          createdAt: messageCreatedAt,
          streaming: false,
          source: "native",
        },
      ]);
      forceStickToBottom();

      setThreadError(threadIdForSend, null);
      if (expiredTerminalContextCount > 0) {
        const toastCopy = buildExpiredTerminalContextToastCopy(
          expiredTerminalContextCount,
          "omitted",
        );
        toastManager.add({
          type: "warning",
          title: toastCopy.title,
          description: toastCopy.description,
        });
      }
      clearComposerInput(threadIdForSend);

      let createdServerThreadForLocalDraft = false;
      let turnStartSucceeded = false;
      let nextThreadBranch = activeThread.branch;
      let nextThreadWorktreePath = activeThread.worktreePath;

      await (async () => {
        if (baseBranchForWorktree) {
          beginLocalDispatch({ preparingWorktree: true });
          const result = await createWorktree({
            cwd: activeProject.cwd,
            branch: baseBranchForWorktree,
            newBranch: buildTemporaryWorktreeBranchName(),
          });
          nextThreadBranch = result.worktree.branch;
          nextThreadWorktreePath = result.worktree.path;
          const nextAssociatedWorktree = deriveAssociatedWorktreeMetadata({
            branch: result.worktree.branch,
            worktreePath: result.worktree.path,
          });
          if (isServerThread) {
            await api.orchestration.dispatchCommand({
              type: "thread.meta.update",
              commandId: newCommandId(),
              threadId: threadIdForSend,
              envMode: "worktree",
              branch: result.worktree.branch,
              worktreePath: result.worktree.path,
              associatedWorktreePath: nextAssociatedWorktree.associatedWorktreePath,
              associatedWorktreeBranch: nextAssociatedWorktree.associatedWorktreeBranch,
              associatedWorktreeRef: nextAssociatedWorktree.associatedWorktreeRef,
            });
            setStoreThreadWorkspace(threadIdForSend, {
              branch: result.worktree.branch,
              worktreePath: result.worktree.path,
              ...nextAssociatedWorktree,
            });
          }
        }

        let firstComposerImageName: string | null = null;
        if (composerImagesSnapshot.length > 0) {
          const firstComposerImage = composerImagesSnapshot[0];
          if (firstComposerImage) {
            firstComposerImageName = firstComposerImage.name;
          }
        }

        let titleSeed = trimmedPrompt;
        if (!titleSeed) {
          if (firstComposerImageName) {
            titleSeed = `Image: ${firstComposerImageName}`;
          } else if (composerTerminalContextsSnapshot.length > 0) {
            titleSeed = formatTerminalContextLabel(composerTerminalContextsSnapshot[0]!);
          } else {
            titleSeed = GENERIC_CHAT_THREAD_TITLE;
          }
        }

        const title = buildPromptThreadTitleFallback(titleSeed);
        const threadCreateModelSelection: ModelSelection = {
          provider: selectedProviderForSend,
          model:
            selectedModelForSend ||
            activeProject.defaultModelSelection?.model ||
            DEFAULT_MODEL_BY_PROVIDER.codex,
          ...(selectedModelSelectionForSend.options
            ? { options: selectedModelSelectionForSend.options }
            : {}),
        };

        if (isLocalDraftThread) {
          await api.orchestration.dispatchCommand({
            type: "thread.create",
            commandId: newCommandId(),
            threadId: threadIdForSend,
            projectId: activeProject.id,
            title,
            modelSelection: threadCreateModelSelection,
            runtimeMode: runtimeModeForSend,
            interactionMode: interactionModeForSend,
            envMode: envModeForSend,
            branch: nextThreadBranch,
            worktreePath: nextThreadWorktreePath,
            createdAt: activeThread.createdAt,
          });
          createdServerThreadForLocalDraft = true;
        }

        let setupScript: ProjectScript | null = null;
        if (baseBranchForWorktree) {
          setupScript = setupProjectScript(activeProject.scripts);
        }
        if (setupScript) {
          const shouldRunSetupScript = isServerThread || createdServerThreadForLocalDraft;
          if (shouldRunSetupScript) {
            const setupScriptOptions: RunProjectScriptOptions = {
              worktreePath: nextThreadWorktreePath,
              rememberAsLastInvoked: false,
            };
            if (nextThreadWorktreePath) {
              setupScriptOptions.cwd = nextThreadWorktreePath;
            }
            await runProjectScript(setupScript, setupScriptOptions);
          }
        }

        if (isServerThread) {
          await persistThreadSettingsForNextTurn({
            threadId: threadIdForSend,
            createdAt: messageCreatedAt,
            ...(selectedModelForSend ? { modelSelection: selectedModelSelectionForSend } : {}),
            runtimeMode: runtimeModeForSend,
            interactionMode: interactionModeForSend,
          });
        }

        beginLocalDispatch();
        const turnAttachments = await turnAttachmentsPromise;
        await api.orchestration.dispatchCommand({
          type: "thread.turn.start",
          commandId: newCommandId(),
          threadId: threadIdForSend,
          message: {
            messageId: messageIdForSend,
            role: "user",
            text: outgoingMessageText,
            attachments: turnAttachments,
            ...(mentionedSkillsForSend.length > 0 ? { skills: mentionedSkillsForSend } : {}),
            ...(mentionedPluginMentionsForSend.length > 0
              ? { mentions: mentionedPluginMentionsForSend }
              : {}),
          },
          modelSelection: selectedModelSelectionForSend,
          ...(providerOptionsForDispatchForSend
            ? { providerOptions: providerOptionsForDispatchForSend }
            : {}),
          assistantDeliveryMode: settingsEnableAssistantStreaming ? "streaming" : "buffered",
          dispatchMode,
          runtimeMode: runtimeModeForSend,
          interactionMode: interactionModeForSend,
          createdAt: messageCreatedAt,
        });
        turnStartSucceeded = true;
      })().catch(async (err: unknown) => {
        if (createdServerThreadForLocalDraft && !turnStartSucceeded) {
          await api.orchestration
            .dispatchCommand({
              type: "thread.delete",
              commandId: newCommandId(),
              threadId: threadIdForSend,
            })
            .catch(() => undefined);
        }

        if (
          queuedChatTurn === null &&
          !turnStartSucceeded &&
          promptRef.current.length === 0 &&
          composerImagesRef.current.length === 0 &&
          composerTerminalContextsRef.current.length === 0
        ) {
          setOptimisticUserMessages((existing) => {
            const removed = existing.filter((message) => message.id === messageIdForSend);
            for (const message of removed) {
              revokeUserMessagePreviewUrls(message);
            }
            const next = existing.filter((message) => message.id !== messageIdForSend);
            return next.length === existing.length ? existing : next;
          });
          restoreFailedComposerSendDraft({
            prompt: promptForSend,
            images: composerImagesSnapshot.map(cloneComposerImageForRetry),
            terminalContexts: composerTerminalContextsSnapshot,
            skills: composerSkillsSnapshot,
            mentions: composerMentionsSnapshot,
          });
        }

        setThreadError(
          threadIdForSend,
          err instanceof Error ? err.message : "Failed to send message.",
        );
      });

      sendInFlightRef.current = false;
      if (!turnStartSucceeded) {
        resetLocalDispatch();
      }
      return turnStartSucceeded;
    },
    [
      activeThread,
      beginLocalDispatch,
      clearComposerInput,
      composerImagesRef,
      composerTerminalContextsRef,
      createWorktree,
      forceStickToBottom,
      formatOutgoingPrompt,
      isConnecting,
      isLocalDraftThread,
      isSendBusy,
      isServerThread,
      persistThreadSettingsForNextTurn,
      promptIncludesSkillMention,
      promptRef,
      resolvePromptPluginMentions,
      restoreFailedComposerSendDraft,
      runProjectScript,
      sendInFlightRef,
      setOptimisticUserMessages,
      setStoreThreadWorkspace,
      setThreadError,
      settingsEnableAssistantStreaming,
      resetLocalDispatch,
    ],
  );

  return {
    beginLocalDispatch,
    dispatchChatTurn,
    onInterrupt,
    resetLocalDispatch,
  };
}
