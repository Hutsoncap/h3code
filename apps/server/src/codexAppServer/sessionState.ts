import type { ProviderSession, TurnId } from "@t3tools/contracts";

export function buildThreadStartedSessionUpdate(input: {
  readonly startedThreadId: string | undefined;
  readonly isChildConversation: boolean;
}): Partial<ProviderSession> | undefined {
  if (!input.startedThreadId || input.isChildConversation) {
    return undefined;
  }

  return {
    resumeCursor: { threadId: input.startedThreadId },
  };
}

export function buildTurnStartedSessionUpdate(input: {
  readonly turnId: TurnId | undefined;
  readonly isChildConversation: boolean;
}): Partial<ProviderSession> | undefined {
  if (input.isChildConversation) {
    return undefined;
  }

  return {
    status: "running",
    activeTurnId: input.turnId,
  };
}

export function buildTurnCompletedSessionUpdate(input: {
  readonly turnStatus: string | undefined;
  readonly errorMessage: string | undefined;
  readonly currentLastError: string | undefined;
  readonly isChildConversation: boolean;
}): Partial<ProviderSession> | undefined {
  if (input.isChildConversation) {
    return undefined;
  }

  return {
    status: input.turnStatus === "failed" ? "error" : "ready",
    activeTurnId: undefined,
    lastError: input.errorMessage ?? input.currentLastError,
  };
}

export function buildRuntimeErrorSessionUpdate(input: {
  readonly message: string | undefined;
  readonly willRetry: boolean | undefined;
  readonly currentLastError: string | undefined;
  readonly isChildConversation: boolean;
  readonly isNonFatalCodexErrorMessage: (message: string) => boolean;
}): Partial<ProviderSession> | undefined {
  if (input.isChildConversation) {
    return undefined;
  }

  if (input.willRetry) {
    return {
      status: "running",
    };
  }

  if (input.message !== undefined && input.isNonFatalCodexErrorMessage(input.message)) {
    return undefined;
  }

  return {
    status: "error",
    lastError: input.message ?? input.currentLastError,
  };
}
