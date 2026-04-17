import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

import { makeServerReadiness, type ServerReadiness } from "./readiness";

function readinessSnapshot(readiness: ServerReadiness) {
  return Effect.runPromise(readiness.getSnapshot);
}

describe("makeServerReadiness", () => {
  it("keeps readiness markers idempotent and snapshots monotonic", async () => {
    const readiness = await Effect.runPromise(makeServerReadiness);

    expect(await readinessSnapshot(readiness)).toEqual({
      httpListening: false,
      pushBusReady: false,
      keybindingsReady: false,
      terminalSubscriptionsReady: false,
      orchestrationSubscriptionsReady: false,
      startupReady: false,
    });

    await Effect.runPromise(readiness.markPushBusReady);
    await Effect.runPromise(readiness.markPushBusReady);

    expect(await readinessSnapshot(readiness)).toEqual({
      httpListening: false,
      pushBusReady: true,
      keybindingsReady: false,
      terminalSubscriptionsReady: false,
      orchestrationSubscriptionsReady: false,
      startupReady: false,
    });

    await Effect.runPromise(readiness.markKeybindingsReady);
    await Effect.runPromise(readiness.markKeybindingsReady);

    expect(await readinessSnapshot(readiness)).toEqual({
      httpListening: false,
      pushBusReady: true,
      keybindingsReady: true,
      terminalSubscriptionsReady: false,
      orchestrationSubscriptionsReady: false,
      startupReady: false,
    });
  });

  it("waits for every unique readiness marker before becoming ready", async () => {
    const readiness = await Effect.runPromise(makeServerReadiness);

    const beforeReady = await Effect.runPromise(
      readiness.awaitServerReady.pipe(Effect.timeoutOption("10 millis")),
    );
    expect(Option.isNone(beforeReady)).toBe(true);

    await Effect.runPromise(readiness.markPushBusReady);
    await Effect.runPromise(readiness.markHttpListening);
    await Effect.runPromise(readiness.markTerminalSubscriptionsReady);
    await Effect.runPromise(readiness.markPushBusReady);
    await Effect.runPromise(readiness.markKeybindingsReady);

    const stillWaiting = await Effect.runPromise(
      readiness.awaitServerReady.pipe(Effect.timeoutOption("10 millis")),
    );
    expect(Option.isNone(stillWaiting)).toBe(true);

    await Effect.runPromise(readiness.markOrchestrationSubscriptionsReady);

    const ready = await Effect.runPromise(
      readiness.awaitServerReady.pipe(Effect.timeoutOption("10 millis")),
    );
    expect(Option.isSome(ready)).toBe(true);

    expect(await readinessSnapshot(readiness)).toEqual({
      httpListening: true,
      pushBusReady: true,
      keybindingsReady: true,
      terminalSubscriptionsReady: true,
      orchestrationSubscriptionsReady: true,
      startupReady: true,
    });

    await Effect.runPromise(readiness.markOrchestrationSubscriptionsReady);

    const stillReady = await Effect.runPromise(
      readiness.awaitServerReady.pipe(Effect.timeoutOption("10 millis")),
    );
    expect(Option.isSome(stillReady)).toBe(true);
  });
});
