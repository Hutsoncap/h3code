// FILE: useChatPlanHandoffBindings.ts
// Purpose: Own ChatView's plan-sidebar and handoff state/callback orchestration.
// Layer: ChatView hook
// Depends on: thread handoff helpers, router navigation, and shell/footer plan state.

import {
  type ProviderKind,
  PROVIDER_DISPLAY_NAMES,
  type ThreadId,
  type TurnId,
} from "@t3tools/contracts";
import { type useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type Thread } from "../../types";
import {
  canCreateThreadHandoff,
  resolveHandoffTargetProvider,
  resolveThreadHandoffBadgeLabel,
} from "../../lib/threadHandoff";
import { toastManager } from "../ui/toast";

interface UseChatPlanHandoffBindingsOptions {
  activePlanTurnId: TurnId | null;
  activeProjectExists: boolean;
  activeThread: Thread | undefined;
  createThreadHandoff: (thread: Thread) => Promise<ThreadId>;
  hasPendingApprovals: boolean;
  hasPendingUserInput: boolean;
  isServerThread: boolean;
  isWorking: boolean;
  navigate: ReturnType<typeof useNavigate>;
  sidebarProposedPlanTurnId: TurnId | null;
}

interface UseChatPlanHandoffBindingsResult {
  closePlanSidebar: () => void;
  handleImplementationThreadOpened: (nextThreadId: ThreadId) => Promise<void>;
  handlePlanImplementationStarted: () => void;
  handoffActionLabel: string;
  handoffBadgeLabel: string | null;
  handoffBadgeSourceProvider: ProviderKind | null;
  handoffBadgeTargetProvider: ProviderKind | null;
  handoffDisabled: boolean;
  handoffTargetProvider: ProviderKind | null;
  onCreateHandoffThread: () => Promise<void>;
  openPlanSidebar: () => void;
  planSidebarOpen: boolean;
}

export function useChatPlanHandoffBindings(
  options: UseChatPlanHandoffBindingsOptions,
): UseChatPlanHandoffBindingsResult {
  const {
    activePlanTurnId,
    activeProjectExists,
    activeThread,
    createThreadHandoff,
    hasPendingApprovals,
    hasPendingUserInput,
    isServerThread,
    isWorking,
    navigate,
    sidebarProposedPlanTurnId,
  } = options;

  const [planSidebarOpen, setPlanSidebarOpen] = useState(false);
  const planSidebarDismissedForTurnRef = useRef<string | null>(null);
  const planSidebarOpenOnNextThreadRef = useRef(false);

  useEffect(() => {
    if (planSidebarOpenOnNextThreadRef.current) {
      planSidebarOpenOnNextThreadRef.current = false;
      setPlanSidebarOpen(true);
    } else {
      setPlanSidebarOpen(false);
    }
    planSidebarDismissedForTurnRef.current = null;
  }, [activeThread?.id]);

  const handoffBadgeLabel = useMemo(
    () => (activeThread ? resolveThreadHandoffBadgeLabel(activeThread) : null),
    [activeThread],
  );
  const handoffBadgeSourceProvider = activeThread?.handoff?.sourceProvider ?? null;
  const handoffBadgeTargetProvider = activeThread?.handoff
    ? activeThread.modelSelection.provider
    : null;
  const handoffTargetProvider = useMemo(
    () =>
      activeThread ? resolveHandoffTargetProvider(activeThread.modelSelection.provider) : null,
    [activeThread],
  );
  const handoffActionLabel = useMemo(() => {
    if (!activeThread) {
      return "Create handoff thread";
    }
    return `Handoff to ${PROVIDER_DISPLAY_NAMES[handoffTargetProvider ?? "codex"]}`;
  }, [activeThread, handoffTargetProvider]);

  const handoffDisabled = !(
    activeThread &&
    activeProjectExists &&
    isServerThread &&
    canCreateThreadHandoff({
      thread: activeThread,
      isBusy: isWorking,
      hasPendingApprovals,
      hasPendingUserInput,
    })
  );

  const openPlanSidebar = useCallback(() => {
    setPlanSidebarOpen(true);
  }, []);

  const closePlanSidebar = useCallback(() => {
    setPlanSidebarOpen(false);
    const turnKey = activePlanTurnId ?? sidebarProposedPlanTurnId ?? null;
    if (turnKey) {
      planSidebarDismissedForTurnRef.current = turnKey;
    }
  }, [activePlanTurnId, sidebarProposedPlanTurnId]);

  const handlePlanImplementationStarted = useCallback(() => {
    planSidebarDismissedForTurnRef.current = null;
    setPlanSidebarOpen(true);
  }, []);

  const handleImplementationThreadOpened = useCallback(
    async (nextThreadId: ThreadId) => {
      planSidebarOpenOnNextThreadRef.current = true;
      await navigate({
        to: "/$threadId",
        params: { threadId: nextThreadId },
      });
    },
    [navigate],
  );

  const onCreateHandoffThread = useCallback(async () => {
    if (!activeThread || handoffDisabled) {
      return;
    }

    try {
      await createThreadHandoff(activeThread);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not create handoff thread",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while creating the handoff thread.",
      });
    }
  }, [activeThread, createThreadHandoff, handoffDisabled]);

  return {
    closePlanSidebar,
    handleImplementationThreadOpened,
    handlePlanImplementationStarted,
    handoffActionLabel,
    handoffBadgeLabel,
    handoffBadgeSourceProvider,
    handoffBadgeTargetProvider,
    handoffDisabled,
    handoffTargetProvider,
    onCreateHandoffThread,
    openPlanSidebar,
    planSidebarOpen,
  };
}
