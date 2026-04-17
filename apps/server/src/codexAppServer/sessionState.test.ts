import { TurnId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  buildRuntimeErrorSessionUpdate,
  buildThreadStartedSessionUpdate,
  buildTurnCompletedSessionUpdate,
  buildTurnStartedSessionUpdate,
} from "./sessionState";

describe("buildThreadStartedSessionUpdate", () => {
  it("stores the resumed thread id for top-level conversations", () => {
    expect(
      buildThreadStartedSessionUpdate({
        startedThreadId: "provider_thread_1",
        isChildConversation: false,
      }),
    ).toEqual({
      resumeCursor: { threadId: "provider_thread_1" },
    });
  });

  it("ignores child conversations", () => {
    expect(
      buildThreadStartedSessionUpdate({
        startedThreadId: "provider_thread_1",
        isChildConversation: true,
      }),
    ).toBeUndefined();
  });
});

describe("buildTurnStartedSessionUpdate", () => {
  it("marks the session running for top-level turns", () => {
    expect(
      buildTurnStartedSessionUpdate({
        turnId: TurnId.makeUnsafe("turn_1"),
        isChildConversation: false,
      }),
    ).toEqual({
      status: "running",
      activeTurnId: "turn_1",
    });
  });

  it("ignores child turn starts", () => {
    expect(
      buildTurnStartedSessionUpdate({
        turnId: TurnId.makeUnsafe("turn_1"),
        isChildConversation: true,
      }),
    ).toBeUndefined();
  });
});

describe("buildTurnCompletedSessionUpdate", () => {
  it("clears the active turn and returns to ready after success", () => {
    expect(
      buildTurnCompletedSessionUpdate({
        turnStatus: "completed",
        errorMessage: undefined,
        currentLastError: "older error",
        isChildConversation: false,
      }),
    ).toEqual({
      status: "ready",
      activeTurnId: undefined,
      lastError: "older error",
    });
  });

  it("promotes failed turns to session errors", () => {
    expect(
      buildTurnCompletedSessionUpdate({
        turnStatus: "failed",
        errorMessage: "tool failed",
        currentLastError: "older error",
        isChildConversation: false,
      }),
    ).toEqual({
      status: "error",
      activeTurnId: undefined,
      lastError: "tool failed",
    });
  });

  it("ignores child turn completions", () => {
    expect(
      buildTurnCompletedSessionUpdate({
        turnStatus: "completed",
        errorMessage: undefined,
        currentLastError: undefined,
        isChildConversation: true,
      }),
    ).toBeUndefined();
  });
});

describe("buildRuntimeErrorSessionUpdate", () => {
  it("keeps the session running when Codex says it will retry", () => {
    expect(
      buildRuntimeErrorSessionUpdate({
        message: "temporary failure",
        willRetry: true,
        currentLastError: "older error",
        isChildConversation: false,
        isNonFatalCodexErrorMessage: vi.fn().mockReturnValue(false),
      }),
    ).toEqual({
      status: "running",
    });
  });

  it("ignores non-fatal runtime warnings", () => {
    const isNonFatalCodexErrorMessage = vi.fn().mockReturnValue(true);

    expect(
      buildRuntimeErrorSessionUpdate({
        message: "stdin is closed",
        willRetry: false,
        currentLastError: "older error",
        isChildConversation: false,
        isNonFatalCodexErrorMessage,
      }),
    ).toBeUndefined();
    expect(isNonFatalCodexErrorMessage).toHaveBeenCalledWith("stdin is closed");
  });

  it("promotes fatal runtime errors", () => {
    expect(
      buildRuntimeErrorSessionUpdate({
        message: "tool failed",
        willRetry: false,
        currentLastError: "older error",
        isChildConversation: false,
        isNonFatalCodexErrorMessage: vi.fn().mockReturnValue(false),
      }),
    ).toEqual({
      status: "error",
      lastError: "tool failed",
    });
  });

  it("ignores child conversation runtime errors", () => {
    expect(
      buildRuntimeErrorSessionUpdate({
        message: "tool failed",
        willRetry: false,
        currentLastError: "older error",
        isChildConversation: true,
        isNonFatalCodexErrorMessage: vi.fn().mockReturnValue(false),
      }),
    ).toBeUndefined();
  });
});
