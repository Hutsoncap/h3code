// FILE: useChatViewSessionState.ts
// Purpose: Own ChatView's remaining session/view-state derivation cluster.
// Layer: ChatView hook
// Depends on: caller-owned thread/composer state plus session/domain selectors.

import {
  type ApprovalRequestId,
  type ThreadId,
  type ThreadId as ThreadIdType,
} from "@t3tools/contracts";
import { deriveAssociatedWorktreeMetadata } from "@t3tools/shared/threadWorkspace";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  collapseExpandedComposerCursor,
  detectComposerTrigger,
  expandCollapsedComposerCursor,
  type ComposerTrigger,
} from "../../composer-logic";
import type { DraftThreadEnvMode } from "../../composerDraftStore";
import {
  buildPendingUserInputAnswers,
  derivePendingUserInputProgress,
  type PendingUserInputDraftAnswer,
} from "../../pendingUserInput";
import {
  deriveActiveBackgroundTasksState,
  deriveActivePlanState,
  deriveActiveWorkStartedAt,
  derivePendingApprovals,
  derivePendingUserInputs,
  derivePhase,
  findLatestProposedPlan,
  findSidebarProposedPlan,
  hasActionableProposedPlan,
} from "../../session-logic";
import { resolveSubagentPresentationForThread } from "../../lib/subagentPresentation";
import { useStore } from "../../store";
import { createThreadSelector } from "../../storeSelectors";
import type { Thread } from "../../types";
import {
  ACTIVE_TURN_LAYOUT_SETTLE_DELAY_MS,
  hasServerAcknowledgedLocalDispatch,
  shouldStartActiveTurnLayoutGrace,
  type LocalDispatchSnapshot,
} from "../ChatView.logic";
import { resolveDiffEnvironmentState } from "../../lib/threadEnvironment";

const EMPTY_PENDING_USER_INPUT_ANSWERS: Record<string, PendingUserInputDraftAnswer> = {};

export interface ChatThreadBreadcrumb {
  threadId: ThreadIdType;
  title: string;
}

function buildThreadBreadcrumbs(
  threads: ReadonlyArray<Thread>,
  thread: Pick<Thread, "id" | "parentThreadId"> | null | undefined,
): ChatThreadBreadcrumb[] {
  if (!thread?.parentThreadId) {
    return [];
  }

  const threadById = new Map(threads.map((entry) => [entry.id, entry] as const));
  const breadcrumbs: ChatThreadBreadcrumb[] = [];
  const visited = new Set<ThreadIdType>();
  let currentParentId: ThreadIdType | null = thread.parentThreadId ?? null;

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parentThread = threadById.get(currentParentId);
    if (!parentThread) {
      break;
    }
    breadcrumbs.unshift({
      threadId: parentThread.id,
      title: parentThread.parentThreadId
        ? resolveSubagentPresentationForThread({ thread: parentThread, threads }).fullLabel
        : parentThread.title,
    });
    currentParentId = parentThread.parentThreadId ?? null;
  }

  return breadcrumbs;
}

interface UseChatViewSessionStateOptions {
  activeLatestTurn: Thread["latestTurn"] | null;
  activeProjectCwd: string | null;
  activeThread: Thread | undefined;
  allThreads: ReadonlyArray<Thread>;
  draftThreadEnvMode: DraftThreadEnvMode | null;
  draftThreadWorktreePath: string | null;
  hasLiveTurnTail: boolean;
  interactionMode: "default" | "plan";
  isConnecting: boolean;
  isRevertingCheckpoint: boolean;
  isServerThread: boolean;
  latestTurnSettled: boolean;
  localDispatch: LocalDispatchSnapshot | null;
  markThreadVisited: (threadId: ThreadId) => void;
  pendingUserInputAnswersByRequestId: Record<string, Record<string, PendingUserInputDraftAnswer>>;
  pendingUserInputQuestionIndexByRequestId: Record<string, number>;
  promptRef: MutableRefObject<string>;
  respondingUserInputRequestIds: ApprovalRequestId[];
  setComposerCursor: Dispatch<SetStateAction<number>>;
  setComposerHighlightedItemId: Dispatch<SetStateAction<string | null>>;
  setComposerTrigger: Dispatch<SetStateAction<ComposerTrigger | null>>;
  threadActivities: ReadonlyArray<Thread["activities"][number]>;
}

export function useChatViewSessionState(options: UseChatViewSessionStateOptions) {
  const {
    activeLatestTurn,
    activeProjectCwd,
    activeThread,
    allThreads,
    draftThreadEnvMode,
    draftThreadWorktreePath,
    hasLiveTurnTail,
    interactionMode,
    isConnecting,
    isRevertingCheckpoint,
    isServerThread,
    latestTurnSettled,
    localDispatch,
    markThreadVisited,
    pendingUserInputAnswersByRequestId,
    pendingUserInputQuestionIndexByRequestId,
    promptRef,
    respondingUserInputRequestIds,
    setComposerCursor,
    setComposerHighlightedItemId,
    setComposerTrigger,
    threadActivities,
  } = options;

  const threadBreadcrumbs = useMemo(
    () => buildThreadBreadcrumbs(allThreads, activeThread),
    [activeThread, allThreads],
  );
  const resolvedThreadEnvMode = isServerThread
    ? (activeThread?.envMode ?? null)
    : draftThreadEnvMode;
  const resolvedThreadWorktreePath = isServerThread
    ? (activeThread?.worktreePath ?? null)
    : draftThreadWorktreePath;
  const diffEnvironmentState = resolveDiffEnvironmentState({
    projectCwd: activeProjectCwd,
    envMode: resolvedThreadEnvMode,
    worktreePath: resolvedThreadWorktreePath,
  });
  const diffEnvironmentPending = diffEnvironmentState.pending;
  const diffDisabledReason = diffEnvironmentState.disabledReason;
  const activeThreadAssociatedWorktree = useMemo(
    () =>
      deriveAssociatedWorktreeMetadata({
        branch: activeThread?.branch ?? null,
        worktreePath: activeThread?.worktreePath ?? null,
        associatedWorktreePath: activeThread?.associatedWorktreePath ?? null,
        associatedWorktreeBranch: activeThread?.associatedWorktreeBranch ?? null,
        associatedWorktreeRef: activeThread?.associatedWorktreeRef ?? null,
      }),
    [
      activeThread?.associatedWorktreeBranch,
      activeThread?.associatedWorktreePath,
      activeThread?.associatedWorktreeRef,
      activeThread?.branch,
      activeThread?.worktreePath,
    ],
  );

  useEffect(() => {
    if (!activeThread?.id) return;
    if (!latestTurnSettled) return;
    if (!activeLatestTurn?.completedAt) return;

    const turnCompletedAt = Date.parse(activeLatestTurn.completedAt);
    if (Number.isNaN(turnCompletedAt)) return;
    const lastVisitedAt = activeThread.lastVisitedAt ? Date.parse(activeThread.lastVisitedAt) : NaN;
    if (!Number.isNaN(lastVisitedAt) && lastVisitedAt >= turnCompletedAt) return;

    markThreadVisited(activeThread.id);
  }, [latestTurnSettled, activeLatestTurn, activeThread, markThreadVisited]);

  const phase = derivePhase(activeThread?.session ?? null);
  const pendingApprovals = useMemo(
    () => derivePendingApprovals(threadActivities),
    [threadActivities],
  );
  const pendingUserInputs = useMemo(
    () => derivePendingUserInputs(threadActivities),
    [threadActivities],
  );
  const activePendingUserInput = pendingUserInputs[0] ?? null;
  const activePendingDraftAnswers = useMemo(
    () =>
      activePendingUserInput
        ? (pendingUserInputAnswersByRequestId[activePendingUserInput.requestId] ??
          EMPTY_PENDING_USER_INPUT_ANSWERS)
        : EMPTY_PENDING_USER_INPUT_ANSWERS,
    [activePendingUserInput, pendingUserInputAnswersByRequestId],
  );
  const activePendingQuestionIndex = activePendingUserInput
    ? (pendingUserInputQuestionIndexByRequestId[activePendingUserInput.requestId] ?? 0)
    : 0;
  const activePendingProgress = useMemo(
    () =>
      activePendingUserInput
        ? derivePendingUserInputProgress(
            activePendingUserInput.questions,
            activePendingDraftAnswers,
            activePendingQuestionIndex,
          )
        : null,
    [activePendingDraftAnswers, activePendingQuestionIndex, activePendingUserInput],
  );
  const activePendingResolvedAnswers = useMemo(
    () =>
      activePendingUserInput
        ? buildPendingUserInputAnswers(activePendingUserInput.questions, activePendingDraftAnswers)
        : null,
    [activePendingDraftAnswers, activePendingUserInput],
  );
  const activePendingIsResponding = activePendingUserInput
    ? respondingUserInputRequestIds.includes(activePendingUserInput.requestId)
    : false;
  const activeProposedPlan = useMemo(() => {
    if (!latestTurnSettled) {
      return null;
    }
    return findLatestProposedPlan(
      activeThread?.proposedPlans ?? [],
      activeLatestTurn?.turnId ?? null,
    );
  }, [activeLatestTurn?.turnId, activeThread?.proposedPlans, latestTurnSettled]);
  const sidebarPlanSourceThreadId = !latestTurnSettled
    ? (activeLatestTurn?.sourceProposedPlan?.threadId ?? null)
    : null;
  const sidebarPlanSourceThread = useStore(
    useMemo(() => createThreadSelector(sidebarPlanSourceThreadId), [sidebarPlanSourceThreadId]),
  );
  const activeThreadPlanThreadId = activeThread?.id ?? null;
  const activeThreadPlanProposedPlans = activeThread?.proposedPlans;
  const sidebarPlanSourceThreadPlanId = sidebarPlanSourceThread?.id ?? null;
  const sidebarPlanSourceThreadProposedPlans = sidebarPlanSourceThread?.proposedPlans;
  const sidebarProposedPlan = useMemo(
    () =>
      findSidebarProposedPlan({
        threads: [
          ...(activeThreadPlanThreadId
            ? [
                {
                  id: activeThreadPlanThreadId,
                  proposedPlans: activeThreadPlanProposedPlans ?? [],
                },
              ]
            : []),
          ...(sidebarPlanSourceThreadPlanId &&
          sidebarPlanSourceThreadPlanId !== activeThreadPlanThreadId
            ? [
                {
                  id: sidebarPlanSourceThreadPlanId,
                  proposedPlans: sidebarPlanSourceThreadProposedPlans ?? [],
                },
              ]
            : []),
        ],
        latestTurn: activeLatestTurn,
        latestTurnSettled,
        threadId: activeThreadPlanThreadId,
      }),
    [
      activeLatestTurn,
      activeThreadPlanProposedPlans,
      activeThreadPlanThreadId,
      latestTurnSettled,
      sidebarPlanSourceThreadPlanId,
      sidebarPlanSourceThreadProposedPlans,
    ],
  );
  const activePlan = useMemo(
    () =>
      latestTurnSettled
        ? null
        : deriveActivePlanState(threadActivities, activeLatestTurn?.turnId ?? undefined),
    [activeLatestTurn?.turnId, latestTurnSettled, threadActivities],
  );
  const activeBackgroundTasks = useMemo(
    () =>
      latestTurnSettled
        ? null
        : deriveActiveBackgroundTasksState(threadActivities, activeLatestTurn?.turnId ?? undefined),
    [activeLatestTurn?.turnId, latestTurnSettled, threadActivities],
  );
  const showPlanFollowUpPrompt =
    pendingUserInputs.length === 0 &&
    interactionMode === "plan" &&
    latestTurnSettled &&
    hasActionableProposedPlan(activeProposedPlan);
  const activePendingApproval = pendingApprovals[0] ?? null;
  const serverAcknowledgedLocalDispatch = useMemo(
    () =>
      hasServerAcknowledgedLocalDispatch({
        localDispatch,
        phase,
        latestTurn: activeLatestTurn,
        session: activeThread?.session ?? null,
        hasPendingApproval: activePendingApproval !== null,
        hasPendingUserInput: activePendingUserInput !== null,
        threadError: activeThread?.error,
      }),
    [
      activeLatestTurn,
      activePendingApproval,
      activePendingUserInput,
      activeThread?.error,
      activeThread?.session,
      localDispatch,
      phase,
    ],
  );
  const isSendBusy = localDispatch !== null && !serverAcknowledgedLocalDispatch;
  const isPreparingWorktree = localDispatch?.preparingWorktree ?? false;
  const hasLiveTurn = phase === "running";
  const isWorking = hasLiveTurn || isSendBusy || isConnecting || isRevertingCheckpoint;
  const activeTurnLayoutLive = isWorking || !latestTurnSettled;
  const [keepSettledActiveTurnLayout, setKeepSettledActiveTurnLayout] = useState(false);
  const previousActiveTurnLayoutLiveRef = useRef(activeTurnLayoutLive);
  const previousActiveTurnLayoutKeyRef = useRef<string | null>(null);
  const activeWorkStartedAt = hasLiveTurnTail
    ? (activeLatestTurn?.startedAt ?? localDispatch?.startedAt ?? null)
    : deriveActiveWorkStartedAt(
        activeLatestTurn,
        activeThread?.session ?? null,
        localDispatch?.startedAt ?? null,
      );
  const activeTurnLayoutKey =
    activeThread?.id === undefined
      ? null
      : `${activeThread.id}:${activeLatestTurn?.turnId ?? "idle"}`;
  const activeTurnInProgress = activeTurnLayoutLive || keepSettledActiveTurnLayout;
  const isComposerApprovalState = activePendingApproval !== null;
  const composerFooterHasWideActions = showPlanFollowUpPrompt || activePendingProgress !== null;
  const lastSyncedPendingInputRef = useRef<{
    requestId: string | null;
    questionId: string | null;
  } | null>(null);

  useLayoutEffect(() => {
    if (previousActiveTurnLayoutKeyRef.current !== activeTurnLayoutKey) {
      previousActiveTurnLayoutKeyRef.current = activeTurnLayoutKey;
      previousActiveTurnLayoutLiveRef.current = activeTurnLayoutLive;
      setKeepSettledActiveTurnLayout(false);
      return;
    }

    const shouldStartGrace = shouldStartActiveTurnLayoutGrace({
      previousTurnLayoutLive: previousActiveTurnLayoutLiveRef.current,
      currentTurnLayoutLive: activeTurnLayoutLive,
      latestTurnStartedAt: activeLatestTurn?.startedAt ?? null,
    });
    previousActiveTurnLayoutLiveRef.current = activeTurnLayoutLive;

    if (activeTurnLayoutLive) {
      setKeepSettledActiveTurnLayout(false);
      return;
    }

    if (!shouldStartGrace) {
      return;
    }

    setKeepSettledActiveTurnLayout(true);
    const timeoutId = window.setTimeout(() => {
      setKeepSettledActiveTurnLayout(false);
    }, ACTIVE_TURN_LAYOUT_SETTLE_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeLatestTurn?.startedAt, activeTurnLayoutKey, activeTurnLayoutLive]);

  useEffect(() => {
    const nextCustomAnswer = activePendingProgress?.customAnswer;
    if (typeof nextCustomAnswer !== "string") {
      lastSyncedPendingInputRef.current = null;
      return;
    }
    const nextRequestId = activePendingUserInput?.requestId ?? null;
    const nextQuestionId = activePendingProgress?.activeQuestion?.id ?? null;
    const questionChanged =
      lastSyncedPendingInputRef.current?.requestId !== nextRequestId ||
      lastSyncedPendingInputRef.current?.questionId !== nextQuestionId;
    const textChangedExternally = promptRef.current !== nextCustomAnswer;

    lastSyncedPendingInputRef.current = {
      requestId: nextRequestId,
      questionId: nextQuestionId,
    };

    if (!questionChanged && !textChangedExternally) {
      return;
    }

    promptRef.current = nextCustomAnswer;
    const nextCursor = collapseExpandedComposerCursor(nextCustomAnswer, nextCustomAnswer.length);
    setComposerCursor(nextCursor);
    setComposerTrigger(
      detectComposerTrigger(
        nextCustomAnswer,
        expandCollapsedComposerCursor(nextCustomAnswer, nextCursor),
      ),
    );
    setComposerHighlightedItemId(null);
  }, [
    activePendingProgress?.customAnswer,
    activePendingProgress?.activeQuestion?.id,
    activePendingUserInput?.requestId,
    promptRef,
    setComposerCursor,
    setComposerHighlightedItemId,
    setComposerTrigger,
  ]);

  return {
    activeBackgroundTasks,
    activePendingApproval,
    activePendingDraftAnswers,
    activePendingIsResponding,
    activePendingProgress,
    activePendingQuestionIndex,
    activePendingResolvedAnswers,
    activePendingUserInput,
    activePlan,
    activeProposedPlan,
    activeThreadAssociatedWorktree,
    activeTurnInProgress,
    activeWorkStartedAt,
    composerFooterHasWideActions,
    diffDisabledReason,
    diffEnvironmentPending,
    hasLiveTurn,
    isComposerApprovalState,
    isPreparingWorktree,
    isSendBusy,
    isWorking,
    pendingApprovals,
    pendingUserInputs,
    phase,
    resolvedThreadEnvMode,
    resolvedThreadWorktreePath,
    serverAcknowledgedLocalDispatch,
    showPlanFollowUpPrompt,
    sidebarProposedPlan,
    threadBreadcrumbs,
  };
}
