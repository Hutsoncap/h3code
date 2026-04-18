import {
  type ApprovalRequestId,
  type ProviderApprovalDecision,
  type ThreadId,
} from "@t3tools/contracts";
import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from "react";

import { type ComposerTrigger, detectComposerTrigger } from "../../composer-logic";
import { newCommandId } from "../../lib/utils";
import { readNativeApi } from "../../nativeApi";
import {
  setPendingUserInputCustomAnswer,
  togglePendingUserInputOptionSelection,
  type PendingUserInputDraftAnswer,
  type PendingUserInputProgress,
} from "../../pendingUserInput";
import type { PendingUserInput } from "../../session-logic";

type PendingUserInputAnswersByRequestId = Record<
  string,
  Record<string, PendingUserInputDraftAnswer>
>;

interface UseChatPendingInteractionBindingsOptions {
  activePendingProgress: PendingUserInputProgress | null;
  activePendingResolvedAnswers: Record<string, string | string[]> | null;
  activePendingUserInput: PendingUserInput | null;
  activeThreadId: ThreadId | null;
  promptRef: MutableRefObject<string>;
  setComposerCursor: (cursor: number) => void;
  setComposerTrigger: (trigger: ComposerTrigger | null) => void;
  setPendingUserInputAnswersByRequestId: Dispatch<
    SetStateAction<PendingUserInputAnswersByRequestId>
  >;
  setPendingUserInputQuestionIndexByRequestId: Dispatch<SetStateAction<Record<string, number>>>;
  setRespondingRequestIds: Dispatch<SetStateAction<ApprovalRequestId[]>>;
  setRespondingUserInputRequestIds: Dispatch<SetStateAction<ApprovalRequestId[]>>;
  setStoreThreadError: (threadId: ThreadId, error: string | null) => void;
}

interface UseChatPendingInteractionBindingsResult {
  onAdvanceActivePendingUserInput: () => void;
  onChangeActivePendingUserInputCustomAnswer: (
    questionId: string,
    value: string,
    nextCursor: number,
    expandedCursor: number,
    cursorAdjacentToMention: boolean,
  ) => void;
  onPreviousActivePendingUserInputQuestion: () => void;
  onRespondToApproval: (
    requestId: ApprovalRequestId,
    decision: ProviderApprovalDecision,
  ) => Promise<void>;
  onToggleActivePendingUserInputOption: (questionId: string, optionLabel: string) => void;
  setActivePendingUserInputCustomAnswerValue: (questionId: string, value: string) => void;
}

// Owns the approval/user-input response flow plus draft answer mutations so ChatView only wires pending UI.
export function useChatPendingInteractionBindings(
  options: UseChatPendingInteractionBindingsOptions,
): UseChatPendingInteractionBindingsResult {
  const {
    activePendingProgress,
    activePendingResolvedAnswers,
    activePendingUserInput,
    activeThreadId,
    promptRef,
    setComposerCursor,
    setComposerTrigger,
    setPendingUserInputAnswersByRequestId,
    setPendingUserInputQuestionIndexByRequestId,
    setRespondingRequestIds,
    setRespondingUserInputRequestIds,
    setStoreThreadError,
  } = options;

  const onRespondToApproval = useCallback(
    async (requestId: ApprovalRequestId, decision: ProviderApprovalDecision) => {
      const api = readNativeApi();
      if (!api || !activeThreadId) {
        return;
      }

      setRespondingRequestIds((existing) =>
        existing.includes(requestId) ? existing : [...existing, requestId],
      );
      await api.orchestration
        .dispatchCommand({
          type: "thread.approval.respond",
          commandId: newCommandId(),
          threadId: activeThreadId,
          requestId,
          decision,
          createdAt: new Date().toISOString(),
        })
        .catch((err: unknown) => {
          setStoreThreadError(
            activeThreadId,
            err instanceof Error ? err.message : "Failed to submit approval decision.",
          );
        });
      setRespondingRequestIds((existing) => existing.filter((id) => id !== requestId));
    },
    [activeThreadId, setRespondingRequestIds, setStoreThreadError],
  );

  const onRespondToUserInput = useCallback(
    async (requestId: ApprovalRequestId, answers: Record<string, unknown>) => {
      const api = readNativeApi();
      if (!api || !activeThreadId) {
        return;
      }

      setRespondingUserInputRequestIds((existing) =>
        existing.includes(requestId) ? existing : [...existing, requestId],
      );
      await api.orchestration
        .dispatchCommand({
          type: "thread.user-input.respond",
          commandId: newCommandId(),
          threadId: activeThreadId,
          requestId,
          answers,
          createdAt: new Date().toISOString(),
        })
        .catch((err: unknown) => {
          setStoreThreadError(
            activeThreadId,
            err instanceof Error ? err.message : "Failed to submit user input.",
          );
        });
      setRespondingUserInputRequestIds((existing) => existing.filter((id) => id !== requestId));
    },
    [activeThreadId, setRespondingUserInputRequestIds, setStoreThreadError],
  );

  const setActivePendingUserInputQuestionIndex = useCallback(
    (nextQuestionIndex: number) => {
      if (!activePendingUserInput) {
        return;
      }
      setPendingUserInputQuestionIndexByRequestId((existing) => ({
        ...existing,
        [activePendingUserInput.requestId]: nextQuestionIndex,
      }));
    },
    [activePendingUserInput, setPendingUserInputQuestionIndexByRequestId],
  );

  const setActivePendingUserInputCustomAnswerValue = useCallback(
    (questionId: string, value: string) => {
      if (!activePendingUserInput) {
        return;
      }
      promptRef.current = value;
      setPendingUserInputAnswersByRequestId((existing) => ({
        ...existing,
        [activePendingUserInput.requestId]: {
          ...existing[activePendingUserInput.requestId],
          [questionId]: setPendingUserInputCustomAnswer(
            existing[activePendingUserInput.requestId]?.[questionId],
            value,
          ),
        },
      }));
    },
    [activePendingUserInput, promptRef, setPendingUserInputAnswersByRequestId],
  );

  const onToggleActivePendingUserInputOption = useCallback(
    (questionId: string, optionLabel: string) => {
      if (!activePendingUserInput) {
        return;
      }
      const question = activePendingUserInput.questions.find((entry) => entry.id === questionId);
      if (!question) {
        return;
      }
      setPendingUserInputAnswersByRequestId((existing) => ({
        ...existing,
        [activePendingUserInput.requestId]: {
          ...existing[activePendingUserInput.requestId],
          [questionId]: togglePendingUserInputOptionSelection(
            question,
            existing[activePendingUserInput.requestId]?.[questionId],
            optionLabel,
          ),
        },
      }));
      promptRef.current = "";
      setComposerCursor(0);
      setComposerTrigger(null);
    },
    [
      activePendingUserInput,
      promptRef,
      setComposerCursor,
      setComposerTrigger,
      setPendingUserInputAnswersByRequestId,
    ],
  );

  const onChangeActivePendingUserInputCustomAnswer = useCallback(
    (
      questionId: string,
      value: string,
      nextCursor: number,
      expandedCursor: number,
      cursorAdjacentToMention: boolean,
    ) => {
      setActivePendingUserInputCustomAnswerValue(questionId, value);
      setComposerCursor(nextCursor);
      setComposerTrigger(
        cursorAdjacentToMention ? null : detectComposerTrigger(value, expandedCursor),
      );
    },
    [setActivePendingUserInputCustomAnswerValue, setComposerCursor, setComposerTrigger],
  );

  const onAdvanceActivePendingUserInput = useCallback(() => {
    if (!activePendingUserInput || !activePendingProgress) {
      return;
    }
    if (activePendingProgress.isLastQuestion) {
      if (activePendingResolvedAnswers) {
        void onRespondToUserInput(activePendingUserInput.requestId, activePendingResolvedAnswers);
      }
      return;
    }
    setActivePendingUserInputQuestionIndex(activePendingProgress.questionIndex + 1);
  }, [
    activePendingProgress,
    activePendingResolvedAnswers,
    activePendingUserInput,
    onRespondToUserInput,
    setActivePendingUserInputQuestionIndex,
  ]);

  const onPreviousActivePendingUserInputQuestion = useCallback(() => {
    if (!activePendingProgress) {
      return;
    }
    setActivePendingUserInputQuestionIndex(Math.max(activePendingProgress.questionIndex - 1, 0));
  }, [activePendingProgress, setActivePendingUserInputQuestionIndex]);

  return {
    onAdvanceActivePendingUserInput,
    onChangeActivePendingUserInputCustomAnswer,
    onPreviousActivePendingUserInputQuestion,
    onRespondToApproval,
    onToggleActivePendingUserInputOption,
    setActivePendingUserInputCustomAnswerValue,
  };
}
