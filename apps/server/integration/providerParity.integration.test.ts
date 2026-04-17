import type {
  ProviderKind,
  ProviderRuntimeEvent,
  ProviderSession,
  ProviderTurnStartResult,
} from "@t3tools/contracts";
import { ThreadId } from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { it, assert } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Queue, Stream } from "effect";

import { ProviderUnsupportedError } from "../src/provider/Errors.ts";
import { ProviderAdapterRegistry } from "../src/provider/Services/ProviderAdapterRegistry.ts";
import { ProviderSessionDirectoryLive } from "../src/provider/Layers/ProviderSessionDirectory.ts";
import { makeProviderServiceLive } from "../src/provider/Layers/ProviderService.ts";
import {
  ProviderService,
  type ProviderServiceShape,
} from "../src/provider/Services/ProviderService.ts";
import { AnalyticsService } from "../src/telemetry/Services/AnalyticsService.ts";
import { SqlitePersistenceMemory } from "../src/persistence/Layers/Sqlite.ts";
import { ProviderSessionRuntimeRepositoryLive } from "../src/persistence/Layers/ProviderSessionRuntime.ts";

import {
  makeTestProviderAdapterHarness,
  type TestProviderAdapterHarness,
  type TestTurnResponse,
} from "./TestProviderAdapter.integration.ts";
import { codexTurnApprovalFixture } from "./fixtures/providerRuntime.ts";

const PROVIDER_PARITY_CASES = [
  "codex",
  "claudeAgent",
] as const satisfies ReadonlyArray<ProviderKind>;

interface IntegrationFixture {
  readonly cwd: string;
  readonly harness: TestProviderAdapterHarness;
  readonly layer: Layer.Layer<ProviderService, unknown, never>;
}

interface ParityScenarioResult {
  readonly session: ProviderSession;
  readonly turnStart: ProviderTurnStartResult;
  readonly events: ReadonlyArray<ProviderRuntimeEvent>;
}

const makeWorkspaceDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const cwd = yield* fs.makeTempDirectory();
  yield* fs.writeFileString(pathService.join(cwd, "README.md"), "v1\n");
  return cwd;
}).pipe(Effect.provide(NodeServices.layer));

const makeIntegrationFixture = (provider: ProviderKind) =>
  Effect.gen(function* () {
    const cwd = yield* makeWorkspaceDirectory;
    const harness = yield* makeTestProviderAdapterHarness({ provider });

    const registry: typeof ProviderAdapterRegistry.Service = {
      getByProvider: (requestedProvider) =>
        requestedProvider === provider
          ? Effect.succeed(harness.adapter)
          : Effect.fail(new ProviderUnsupportedError({ provider: requestedProvider })),
      listProviders: () => Effect.succeed([provider]),
    };

    const directoryLayer = ProviderSessionDirectoryLive.pipe(
      Layer.provide(ProviderSessionRuntimeRepositoryLive),
    );

    const shared = Layer.mergeAll(
      directoryLayer,
      Layer.succeed(ProviderAdapterRegistry, registry),
      AnalyticsService.layerTest,
    ).pipe(Layer.provide(SqlitePersistenceMemory));

    return {
      cwd,
      harness,
      layer: makeProviderServiceLive().pipe(Layer.provide(shared)),
    } satisfies IntegrationFixture;
  });

const collectEventsDuring = <A, E, R>(
  stream: Stream.Stream<ProviderRuntimeEvent>,
  count: number,
  action: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<ProviderRuntimeEvent>();
    yield* Stream.runForEach(stream, (event) => Queue.offer(queue, event).pipe(Effect.asVoid)).pipe(
      Effect.forkScoped,
    );

    const result = yield* action;
    const events = yield* Effect.forEach(
      Array.from({ length: count }, () => undefined),
      () => Queue.take(queue),
      { discard: false },
    );

    return { result, events } as const;
  });

const runApprovalFlow = (input: {
  readonly provider: ProviderServiceShape;
  readonly harness: TestProviderAdapterHarness;
  readonly threadId: ThreadId;
  readonly response: TestTurnResponse;
}) =>
  Effect.gen(function* () {
    yield* input.harness.queueTurnResponse(input.threadId, input.response);

    const { result, events } = yield* collectEventsDuring(
      input.provider.streamEvents,
      input.response.events.length,
      input.provider.sendTurn({
        threadId: input.threadId,
        input: "request approval",
        attachments: [],
      }),
    );

    return { turnStart: result, events } as const;
  });

const runParityScenario = (providerKind: ProviderKind) =>
  Effect.gen(function* () {
    const fixture = yield* makeIntegrationFixture(providerKind);

    return yield* Effect.gen(function* () {
      const provider = yield* ProviderService;
      const threadId = ThreadId.makeUnsafe("thread-provider-parity");
      const session = yield* provider.startSession(threadId, {
        threadId,
        provider: providerKind,
        cwd: fixture.cwd,
        runtimeMode: "full-access",
      });

      const { turnStart, events } = yield* runApprovalFlow({
        provider,
        harness: fixture.harness,
        threadId,
        response: { events: codexTurnApprovalFixture },
      });

      return {
        session,
        turnStart,
        events,
      } satisfies ParityScenarioResult;
    }).pipe(Effect.provide(fixture.layer));
  });

function normalizeSessionForParity(session: ProviderSession) {
  return {
    ...session,
    provider: "__provider__",
    cwd: "__cwd__",
    createdAt: "__created_at__",
    updatedAt: "__updated_at__",
  };
}

function normalizeEventForParity(event: ProviderRuntimeEvent) {
  return {
    ...event,
    provider: "__provider__",
    eventId: "__event_id__",
    createdAt: "__created_at__",
  };
}

it.effect("keeps the ProviderService approval-turn contract in parity for Codex and Claude", () =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(PROVIDER_PARITY_CASES, runParityScenario, {
      concurrency: "unbounded",
      discard: false,
    });

    for (const [index, providerKind] of PROVIDER_PARITY_CASES.entries()) {
      const result = results[index]!;
      assert.equal(result.session.provider, providerKind);
      assert.deepEqual(
        result.events.map((event) => event.provider),
        Array.from({ length: result.events.length }, () => providerKind),
      );
    }

    const codexResult = results.find((result) => result.session.provider === "codex");
    const claudeResult = results.find((result) => result.session.provider === "claudeAgent");
    if (!codexResult || !claudeResult) {
      throw new Error("Expected parity results for both codex and claudeAgent.");
    }

    assert.deepEqual(
      normalizeSessionForParity(codexResult.session),
      normalizeSessionForParity(claudeResult.session),
    );
    assert.deepEqual(codexResult.turnStart, claudeResult.turnStart);
    assert.deepEqual(
      codexResult.events.map(normalizeEventForParity),
      claudeResult.events.map(normalizeEventForParity),
    );
  }).pipe(Effect.provide(NodeServices.layer)),
);
