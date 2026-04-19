import { Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  BrowserOpenInputSchema,
  DesktopUpdateStateSchema,
  ThreadBrowserStateSchema,
} from "@t3tools/contracts";

import {
  registerValidatedIpcEndpoint,
  registerValidatedIpcHandler,
  safeDecodeIpcPayload,
} from "./ipcHelpers";

type BrowserOpenInput = Schema.Schema.Type<typeof BrowserOpenInputSchema>;

describe("registerValidatedIpcHandler", () => {
  it("parses payloads before invoking the handler", async () => {
    const removeHandler = vi.fn();
    const handle = vi.fn();
    const listener = vi.fn((input: BrowserOpenInput) =>
      "surfaceId" in input ? input.surfaceId.kind : input.threadId,
    );

    registerValidatedIpcHandler(
      { removeHandler, handle },
      "desktop:browser-open",
      BrowserOpenInputSchema,
      listener,
    );

    expect(removeHandler).toHaveBeenCalledWith("desktop:browser-open");
    const registered = handle.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;
    expect(registered).toBeTypeOf("function");

    await expect(
      registered?.({}, { threadId: "thread-1", initialUrl: "https://example.com" }),
    ).resolves.toBe("thread-1");
    expect(listener).toHaveBeenCalledWith({
      threadId: "thread-1",
      initialUrl: "https://example.com",
    });
  });

  it("rejects invalid payloads before handler logic runs", async () => {
    const removeHandler = vi.fn();
    const handle = vi.fn();
    const listener = vi.fn();

    registerValidatedIpcHandler(
      { removeHandler, handle },
      "desktop:browser-open",
      BrowserOpenInputSchema,
      listener,
    );

    const registered = handle.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;
    await expect(registered?.({}, { threadId: 42 })).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it("rejects unknown fields when exact validation is enabled in development", async () => {
    const removeHandler = vi.fn();
    const handle = vi.fn();
    const listener = vi.fn();

    registerValidatedIpcHandler(
      { removeHandler, handle },
      "desktop:browser-open",
      BrowserOpenInputSchema,
      listener,
      {
        rejectUnknownFieldsInDevelopment: true,
        isDevelopment: true,
      },
    );

    const registered = handle.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;
    await expect(
      registered?.({}, { threadId: "thread-1", initialUrl: "https://example.com", extra: true }),
    ).rejects.toThrow(/Unexpected key/);
    expect(listener).not.toHaveBeenCalled();
  });

  it("strips unknown fields outside development exact validation", async () => {
    const removeHandler = vi.fn();
    const handle = vi.fn();
    const listener = vi.fn((input: BrowserOpenInput) => input);

    registerValidatedIpcHandler(
      { removeHandler, handle },
      "desktop:browser-open",
      BrowserOpenInputSchema,
      listener,
      {
        rejectUnknownFieldsInDevelopment: true,
        isDevelopment: false,
      },
    );

    const registered = handle.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;
    await expect(
      registered?.({}, { threadId: "thread-1", initialUrl: "https://example.com", extra: true }),
    ).resolves.toEqual({
      threadId: "thread-1",
      initialUrl: "https://example.com",
    });
    expect(listener).toHaveBeenCalledWith({
      threadId: "thread-1",
      initialUrl: "https://example.com",
    });
  });
});

describe("safeDecodeIpcPayload", () => {
  it("returns null for invalid event payloads", () => {
    expect(
      safeDecodeIpcPayload(ThreadBrowserStateSchema, {
        surfaceId: { kind: "thread", threadId: 42 },
        open: true,
        activeTabId: null,
        tabs: [],
        lastError: null,
      }),
    ).toBeNull();
  });
});

describe("registerValidatedIpcEndpoint", () => {
  it("validates both the incoming payload and the outgoing response", async () => {
    const removeHandler = vi.fn();
    const handle = vi.fn();
    const listener = vi.fn(() => ({
      enabled: true,
      status: "idle" as const,
      currentVersion: "1.0.0",
      hostArch: "x64" as const,
      appArch: "x64" as const,
      runningUnderArm64Translation: false,
      availableVersion: null,
      downloadedVersion: null,
      downloadPercent: null,
      checkedAt: null,
      message: null,
      errorContext: null,
      canRetry: false,
    }));

    registerValidatedIpcEndpoint(
      { removeHandler, handle },
      "desktop:update-get-state",
      Schema.Undefined,
      DesktopUpdateStateSchema,
      listener,
    );

    const registered = handle.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;
    await expect(registered?.({}, undefined)).resolves.toMatchObject({
      status: "idle",
      currentVersion: "1.0.0",
    });
  });

  it("rejects invalid response payloads before replying to the renderer", async () => {
    const removeHandler = vi.fn();
    const handle = vi.fn();

    registerValidatedIpcEndpoint(
      { removeHandler, handle },
      "desktop:update-get-state",
      Schema.Undefined,
      DesktopUpdateStateSchema,
      () =>
        ({
          enabled: true,
          status: "bogus",
        }) as never,
    );

    const registered = handle.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;
    await expect(registered?.({}, undefined)).rejects.toThrow();
  });

  it("rejects unknown response fields when exact validation is enabled in development", async () => {
    const removeHandler = vi.fn();
    const handle = vi.fn();

    registerValidatedIpcEndpoint(
      { removeHandler, handle },
      "desktop:update-get-state",
      Schema.Undefined,
      DesktopUpdateStateSchema,
      () =>
        ({
          enabled: true,
          status: "idle",
          currentVersion: "1.0.0",
          hostArch: "x64",
          appArch: "x64",
          runningUnderArm64Translation: false,
          availableVersion: null,
          downloadedVersion: null,
          downloadPercent: null,
          checkedAt: null,
          message: null,
          errorContext: null,
          canRetry: false,
          extra: true,
        }) as never,
      {
        rejectUnknownFieldsInDevelopment: true,
        isDevelopment: true,
      },
    );

    const registered = handle.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;
    await expect(registered?.({}, undefined)).rejects.toThrow(/Unexpected key/);
  });
});
