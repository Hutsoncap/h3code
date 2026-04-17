import type {
  ProviderComposerCapabilities,
  ProviderKind,
  ProviderListSkillsInput,
  ProviderListSkillsResult,
} from "@t3tools/contracts";
import { it, assert, vi } from "@effect/vitest";

import { Effect, Layer, Stream } from "effect";

import {
  ProviderUnsupportedError,
  type ProviderAdapterError,
  type ProviderValidationError,
} from "../Errors.ts";
import type { ProviderAdapterShape } from "../Services/ProviderAdapter.ts";
import { ProviderAdapterRegistry } from "../Services/ProviderAdapterRegistry.ts";
import { ProviderDiscoveryService } from "../Services/ProviderDiscoveryService.ts";
import { ProviderDiscoveryServiceLive } from "./ProviderDiscoveryService.ts";

type DiscoveryMethodKey =
  | "getComposerCapabilities"
  | "listSkills"
  | "listCommands"
  | "listPlugins"
  | "readPlugin"
  | "listModels";

type DiscoveryMethodOverrides = Partial<
  Pick<ProviderAdapterShape<ProviderAdapterError>, DiscoveryMethodKey>
>;

function makeAdapter(
  provider: ProviderKind,
  overrides?: DiscoveryMethodOverrides,
): ProviderAdapterShape<ProviderAdapterError> {
  return {
    provider,
    capabilities: {
      sessionModelSwitch: "in-session",
    },
    startSession: vi.fn(() => Effect.die("unused startSession")),
    sendTurn: vi.fn(() => Effect.die("unused sendTurn")),
    interruptTurn: vi.fn(() => Effect.die("unused interruptTurn")),
    respondToRequest: vi.fn(() => Effect.die("unused respondToRequest")),
    respondToUserInput: vi.fn(() => Effect.die("unused respondToUserInput")),
    stopSession: vi.fn(() => Effect.void),
    listSessions: vi.fn(() => Effect.succeed([])),
    hasSession: vi.fn(() => Effect.succeed(false)),
    readThread: vi.fn(() => Effect.die("unused readThread")),
    rollbackThread: vi.fn(() => Effect.die("unused rollbackThread")),
    stopAll: vi.fn(() => Effect.void),
    streamEvents: Stream.empty,
    ...overrides,
  };
}

function makeProviderDiscoveryServiceLayer(options?: {
  codex?: DiscoveryMethodOverrides;
  claude?: DiscoveryMethodOverrides;
}) {
  const codex = makeAdapter("codex", options?.codex);
  const claude = makeAdapter("claudeAgent", options?.claude);
  const registry: typeof ProviderAdapterRegistry.Service = {
    getByProvider: (provider) =>
      provider === "codex"
        ? Effect.succeed(codex)
        : provider === "claudeAgent"
          ? Effect.succeed(claude)
          : Effect.fail(new ProviderUnsupportedError({ provider })),
    listProviders: () => Effect.succeed(["codex", "claudeAgent"]),
  };

  return {
    codex,
    claude,
    layer: it.layer(
      ProviderDiscoveryServiceLive.pipe(
        Layer.provide(Layer.succeed(ProviderAdapterRegistry, registry)),
      ),
    ),
  };
}

function assertProviderValidationFailure(
  failure: ProviderValidationError | ProviderAdapterError | ProviderUnsupportedError,
  operation: string,
): asserts failure is ProviderValidationError {
  assert.equal(failure._tag, "ProviderValidationError");
  if (failure._tag !== "ProviderValidationError") {
    return;
  }
  assert.equal(failure.operation, operation);
}

const fallbacks = makeProviderDiscoveryServiceLayer();
fallbacks.layer("ProviderDiscoveryServiceLive fallbacks", (it) => {
  it.effect(
    "returns disabled and unsupported discovery defaults when adapters omit discovery methods",
    () =>
      Effect.gen(function* () {
        const service = yield* ProviderDiscoveryService;

        const capabilities = yield* service.getComposerCapabilities({ provider: "codex" });
        assert.deepStrictEqual(capabilities, {
          provider: "codex",
          supportsSkillMentions: false,
          supportsSkillDiscovery: false,
          supportsNativeSlashCommandDiscovery: false,
          supportsPluginMentions: false,
          supportsPluginDiscovery: false,
          supportsRuntimeModelList: false,
        } satisfies ProviderComposerCapabilities);

        const skills = yield* service.listSkills({ provider: "codex", cwd: "/repo" });
        assert.deepStrictEqual(skills, {
          skills: [],
          source: "unsupported",
          cached: false,
        });

        const commands = yield* service.listCommands({ provider: "codex", cwd: "/repo" });
        assert.deepStrictEqual(commands, {
          commands: [],
          source: "unsupported",
          cached: false,
        });

        const plugins = yield* service.listPlugins({ provider: "codex" });
        assert.deepStrictEqual(plugins, {
          marketplaces: [],
          marketplaceLoadErrors: [],
          remoteSyncError: null,
          featuredPluginIds: [],
          source: "unsupported",
          cached: false,
        });

        const models = yield* service.listModels({ provider: "codex" });
        assert.deepStrictEqual(models, {
          models: [],
          source: "unsupported",
          cached: false,
        });
      }),
  );

  it.effect("returns a validation error when plugin discovery is unsupported", () =>
    Effect.gen(function* () {
      const service = yield* ProviderDiscoveryService;
      const result = yield* Effect.result(
        service.readPlugin({
          provider: "codex",
          marketplacePath: "/plugins",
          pluginName: "plugin-1",
        }),
      );

      assert.equal(result._tag, "Failure");
      if (result._tag !== "Failure") {
        return;
      }

      assertProviderValidationFailure(result.failure, "ProviderDiscoveryService.readPlugin");
      assert.equal(result.failure.issue, "Plugin discovery is unavailable for provider 'codex'.");
    }),
  );
});

const listSkillsMock = vi.fn(
  (input: ProviderListSkillsInput): Effect.Effect<ProviderListSkillsResult> =>
    Effect.succeed({
      skills: [{ name: "alpha", path: input.cwd, enabled: true }],
      source: "codex-adapter",
      cached: false,
    }),
);

const validation = makeProviderDiscoveryServiceLayer({
  codex: {
    listSkills: listSkillsMock,
  },
});

validation.layer("ProviderDiscoveryServiceLive validation", (it) => {
  it.effect("rejects invalid discovery input before reaching adapters", () =>
    Effect.gen(function* () {
      const service = yield* ProviderDiscoveryService;
      const result = yield* Effect.result(
        service.listSkills({
          provider: "codex",
          cwd: "   ",
        } as never),
      );

      assert.equal(result._tag, "Failure");
      if (result._tag !== "Failure") {
        return;
      }

      assertProviderValidationFailure(result.failure, "ProviderDiscoveryService.listSkills");
      assert.equal(listSkillsMock.mock.calls.length, 0);
    }),
  );

  it.effect("passes normalized discovery input to adapter methods", () =>
    Effect.gen(function* () {
      const service = yield* ProviderDiscoveryService;

      const result = yield* service.listSkills({
        provider: "codex",
        cwd: " /repo ",
        threadId: " thread-1 ",
        forceReload: true,
      } as ProviderListSkillsInput);

      assert.deepStrictEqual(result, {
        skills: [{ name: "alpha", path: "/repo", enabled: true }],
        source: "codex-adapter",
        cached: false,
      });
      assert.deepStrictEqual(listSkillsMock.mock.calls[0]?.[0], {
        provider: "codex",
        cwd: "/repo",
        threadId: "thread-1",
        forceReload: true,
      });
    }),
  );
});
