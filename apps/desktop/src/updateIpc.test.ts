import { describe, expect, it, vi } from "vitest";
import type { DesktopUpdateState } from "@t3tools/contracts";

import { registerDesktopUpdateIpcHandlers } from "./updateIpc";

const baseState: DesktopUpdateState = {
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
};

function createRegistrar() {
  const listeners = new Map<string, (event: unknown, payload: unknown) => unknown>();
  return {
    removeHandler: vi.fn((channel: string) => {
      listeners.delete(channel);
    }),
    handle: vi.fn((channel: string, listener: (event: unknown, payload: unknown) => unknown) => {
      listeners.set(channel, listener);
    }),
    listeners,
  };
}

describe("registerDesktopUpdateIpcHandlers", () => {
  it("returns the current update state for get-state and check", async () => {
    const registrar = createRegistrar();
    const checkForUpdates = vi.fn(async () => undefined);

    registerDesktopUpdateIpcHandlers({
      ipc: registrar,
      isDevelopment: true,
      getUpdateState: () => baseState,
      checkForUpdates,
      downloadAvailableUpdate: async () => ({ accepted: true, completed: true }),
      installDownloadedUpdate: async () => ({ accepted: true, completed: true }),
      getIsQuitting: () => false,
    });

    await expect(
      registrar.listeners.get("desktop:update-get-state")?.({}, undefined),
    ).resolves.toEqual(baseState);
    await expect(registrar.listeners.get("desktop:update-check")?.({}, undefined)).resolves.toEqual(
      baseState,
    );
    expect(checkForUpdates).toHaveBeenCalledWith("renderer");
  });

  it("wraps download results in the contracts action payload", async () => {
    const registrar = createRegistrar();
    const downloadAvailableUpdate = vi.fn(async () => ({ accepted: true, completed: false }));

    registerDesktopUpdateIpcHandlers({
      ipc: registrar,
      isDevelopment: true,
      getUpdateState: () => ({ ...baseState, status: "available", availableVersion: "1.1.0" }),
      checkForUpdates: async () => undefined,
      downloadAvailableUpdate,
      installDownloadedUpdate: async () => ({ accepted: true, completed: true }),
      getIsQuitting: () => false,
    });

    await expect(
      registrar.listeners.get("desktop:update-download")?.({}, undefined),
    ).resolves.toMatchObject({
      accepted: true,
      completed: false,
      state: {
        status: "available",
        availableVersion: "1.1.0",
      },
    });
    expect(downloadAvailableUpdate).toHaveBeenCalledTimes(1);
  });

  it("short-circuits install requests while the app is quitting", async () => {
    const registrar = createRegistrar();
    const installDownloadedUpdate = vi.fn(async () => ({ accepted: true, completed: true }));

    registerDesktopUpdateIpcHandlers({
      ipc: registrar,
      isDevelopment: true,
      getUpdateState: () => ({ ...baseState, status: "downloaded", downloadedVersion: "1.1.0" }),
      checkForUpdates: async () => undefined,
      downloadAvailableUpdate: async () => ({ accepted: true, completed: true }),
      installDownloadedUpdate,
      getIsQuitting: () => true,
    });

    await expect(
      registrar.listeners.get("desktop:update-install")?.({}, undefined),
    ).resolves.toEqual({
      accepted: false,
      completed: false,
      state: {
        ...baseState,
        status: "downloaded",
        downloadedVersion: "1.1.0",
      },
    });
    expect(installDownloadedUpdate).not.toHaveBeenCalled();
  });

  it("rejects invalid update state responses before sending them to the renderer", async () => {
    const registrar = createRegistrar();

    registerDesktopUpdateIpcHandlers({
      ipc: registrar,
      isDevelopment: true,
      getUpdateState: () => ({ ...baseState, status: "not-a-status" as never }),
      checkForUpdates: async () => undefined,
      downloadAvailableUpdate: async () => ({ accepted: true, completed: true }),
      installDownloadedUpdate: async () => ({ accepted: true, completed: true }),
      getIsQuitting: () => false,
    });

    await expect(
      registrar.listeners.get("desktop:update-get-state")?.({}, undefined),
    ).rejects.toThrow();
  });
});
