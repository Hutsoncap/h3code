// FILE: providerStatusCache.test.ts
// Purpose: Verifies cache helpers for provider readiness snapshots.
// Exports: Vitest coverage for tolerant cache reads and atomic cache writes.

import path from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vitest";

import {
  orderProviderStatuses,
  readProviderStatusCache,
  resolveProviderStatusCachePath,
  writeProviderStatusCache,
} from "./providerStatusCache";

const readyCodexStatus = {
  provider: "codex" as const,
  status: "ready" as const,
  available: true,
  authStatus: "authenticated" as const,
  checkedAt: "2026-04-15T10:00:00.000Z",
};

const readyClaudeStatus = {
  provider: "claudeAgent" as const,
  status: "ready" as const,
  available: true,
  authStatus: "authenticated" as const,
  checkedAt: "2026-04-15T10:01:00.000Z",
};

describe("providerStatusCache", () => {
  it("normalizes cache paths when the state dir already ends with a separator", () => {
    const stateDir = `${path.join("tmp", "provider-cache")}${path.sep}`;

    expect(
      resolveProviderStatusCachePath({
        stateDir,
        provider: readyCodexStatus.provider,
      }),
    ).toBe(path.join("tmp", "provider-cache", "provider-status", "codex.json"));
  });

  it("writes and reads provider status snapshots", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const tempDir = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "t3-provider-status-cache-",
        });
        const cachePath = resolveProviderStatusCachePath({
          stateDir: tempDir,
          provider: readyCodexStatus.provider,
        });

        yield* writeProviderStatusCache({
          filePath: cachePath,
          provider: readyCodexStatus,
        });

        return yield* readProviderStatusCache(cachePath);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    expect(result).toEqual(readyCodexStatus);
  });

  it("ignores blank cache files", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "t3-provider-status-cache-blank-",
        });
        const cachePath = resolveProviderStatusCachePath({
          stateDir: tempDir,
          provider: readyCodexStatus.provider,
        });

        yield* fileSystem.makeDirectory(path.dirname(cachePath), { recursive: true });
        yield* fileSystem.writeFileString(cachePath, "   \n\t");

        return yield* readProviderStatusCache(cachePath);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    expect(result).toBeUndefined();
  });

  it("ignores malformed cache files", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "t3-provider-status-cache-bad-",
        });
        const cachePath = resolveProviderStatusCachePath({
          stateDir: tempDir,
          provider: readyCodexStatus.provider,
        });

        yield* fileSystem.makeDirectory(path.dirname(cachePath), { recursive: true });
        yield* fileSystem.writeFileString(cachePath, "{ definitely-not-json");

        return yield* readProviderStatusCache(cachePath);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    expect(result).toBeUndefined();
  });

  it("ignores unreadable cache paths", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const tempDir = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "t3-provider-status-cache-dir-",
        });
        const cachePath = resolveProviderStatusCachePath({
          stateDir: tempDir,
          provider: readyCodexStatus.provider,
        });

        yield* fileSystem.makeDirectory(cachePath, { recursive: true });

        return yield* readProviderStatusCache(cachePath);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    expect(result).toBeUndefined();
  });

  it("cleans up temp files when the atomic rename fails", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "t3-provider-status-cache-rename-fail-",
        });
        const cachePath = resolveProviderStatusCachePath({
          stateDir: tempDir,
          provider: readyCodexStatus.provider,
        });

        // Force the final rename to fail while still allowing temp-file creation.
        yield* fileSystem.makeDirectory(cachePath, { recursive: true });

        const writeExit = yield* writeProviderStatusCache({
          filePath: cachePath,
          provider: readyCodexStatus,
        }).pipe(Effect.exit);
        const siblingEntries = yield* fileSystem.readDirectory(path.dirname(cachePath));

        return { siblingEntries, writeExit };
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );

    expect(result.writeExit._tag).toBe("Failure");
    expect(result.siblingEntries.some((entry) => entry.includes(".tmp"))).toBe(false);
  });

  it("keeps provider ordering stable for transport consumers", () => {
    expect(
      orderProviderStatuses([
        {
          ...readyClaudeStatus,
          status: "warning",
          authStatus: "unknown",
        },
        readyCodexStatus,
      ]),
    ).toEqual([
      readyCodexStatus,
      {
        ...readyClaudeStatus,
        status: "warning",
        available: true,
        authStatus: "unknown",
      },
    ]);
  });

  it("keeps unknown providers after known ones without reordering unknown entries", () => {
    const unknownA = {
      provider: "cursor",
      status: "warning",
      available: false,
      authStatus: "unknown",
      checkedAt: "2026-04-15T10:02:00.000Z",
    } as unknown as typeof readyCodexStatus;
    const unknownB = {
      provider: "gemini",
      status: "warning",
      available: false,
      authStatus: "unknown",
      checkedAt: "2026-04-15T10:03:00.000Z",
    } as unknown as typeof readyCodexStatus;

    expect(
      orderProviderStatuses([unknownA, readyClaudeStatus, unknownB, readyCodexStatus]),
    ).toEqual([readyCodexStatus, readyClaudeStatus, unknownA, unknownB]);
  });
});
