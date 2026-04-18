import { describe, expect, it, vi } from "vitest";

import {
  handleDesktopShellOpenExternal,
  handleDesktopShellShowInFolder,
  OPEN_EXTERNAL_CHANNEL,
  registerDesktopShellIpcHandlers,
  SHOW_IN_FOLDER_CHANNEL,
} from "./shellIpc";

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

function createShell() {
  return {
    openExternal: vi.fn(async () => undefined),
    openPath: vi.fn(async () => ""),
    showItemInFolder: vi.fn(),
  };
}

describe("handleDesktopShellOpenExternal", () => {
  it("opens safe http(s) URLs and rejects unsupported protocols", async () => {
    const shell = createShell();

    await expect(
      handleDesktopShellOpenExternal("https://example.com/path", {
        openExternal: shell.openExternal,
      }),
    ).resolves.toBe(true);
    expect(shell.openExternal).toHaveBeenCalledWith("https://example.com/path");

    shell.openExternal.mockClear();

    await expect(
      handleDesktopShellOpenExternal("file:///tmp/project", {
        openExternal: shell.openExternal,
      }),
    ).resolves.toBe(false);
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it("returns false when Electron shell.openExternal fails", async () => {
    const shell = createShell();
    shell.openExternal.mockRejectedValueOnce(new Error("boom"));

    await expect(
      handleDesktopShellOpenExternal("https://example.com/path", {
        openExternal: shell.openExternal,
      }),
    ).resolves.toBe(false);
  });
});

describe("handleDesktopShellShowInFolder", () => {
  it("opens directories through shell.openPath", async () => {
    const shell = createShell();
    const resolvePath = vi.fn((path: string) => `/resolved${path}`);
    const stat = vi.fn(async () => ({ isDirectory: () => true }));

    await expect(
      handleDesktopShellShowInFolder("/tmp/project", {
        openPath: shell.openPath,
        showItemInFolder: shell.showItemInFolder,
        stat,
        resolvePath,
      }),
    ).resolves.toBeUndefined();

    expect(resolvePath).toHaveBeenCalledWith("/tmp/project");
    expect(stat).toHaveBeenCalledWith("/resolved/tmp/project");
    expect(shell.openPath).toHaveBeenCalledWith("/resolved/tmp/project");
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
  });

  it("shows files in their parent folder", async () => {
    const shell = createShell();
    const stat = vi.fn(async () => ({ isDirectory: () => false }));

    await expect(
      handleDesktopShellShowInFolder("/tmp/project/file.txt", {
        openPath: shell.openPath,
        showItemInFolder: shell.showItemInFolder,
        stat,
        resolvePath: (path) => path,
      }),
    ).resolves.toBeUndefined();

    expect(shell.openPath).not.toHaveBeenCalled();
    expect(shell.showItemInFolder).toHaveBeenCalledWith("/tmp/project/file.txt");
  });

  it("surfaces path lookup and openPath errors", async () => {
    const shell = createShell();

    await expect(
      handleDesktopShellShowInFolder("/missing", {
        openPath: shell.openPath,
        showItemInFolder: shell.showItemInFolder,
        stat: vi.fn(async () => {
          throw new Error("missing");
        }),
        resolvePath: (path) => path,
      }),
    ).rejects.toThrow("Folder not found: /missing");

    shell.openPath.mockResolvedValueOnce("Permission denied");

    await expect(
      handleDesktopShellShowInFolder("/tmp/project", {
        openPath: shell.openPath,
        showItemInFolder: shell.showItemInFolder,
        stat: vi.fn(async () => ({ isDirectory: () => true })),
        resolvePath: (path) => path,
      }),
    ).rejects.toThrow("Permission denied");
  });
});

describe("registerDesktopShellIpcHandlers", () => {
  it("trims validated inputs and rejects blank payloads before side effects", async () => {
    const registrar = createRegistrar();
    const shell = createShell();
    const resolvePath = vi.fn((path: string) => path);
    const stat = vi.fn(async () => ({ isDirectory: () => false }));

    registerDesktopShellIpcHandlers({
      ipc: registrar,
      shell,
      stat,
      resolvePath,
    });

    await expect(
      registrar.listeners.get(OPEN_EXTERNAL_CHANNEL)?.({}, " https://example.com/path "),
    ).resolves.toBe(true);
    await expect(
      registrar.listeners.get(SHOW_IN_FOLDER_CHANNEL)?.({}, " /tmp/project/file.txt "),
    ).resolves.toBeUndefined();

    expect(shell.openExternal).toHaveBeenCalledWith("https://example.com/path");
    expect(resolvePath).toHaveBeenCalledWith("/tmp/project/file.txt");
    expect(shell.showItemInFolder).toHaveBeenCalledWith("/tmp/project/file.txt");

    shell.openExternal.mockClear();
    shell.openPath.mockClear();
    shell.showItemInFolder.mockClear();
    resolvePath.mockClear();
    stat.mockClear();

    await expect(registrar.listeners.get(OPEN_EXTERNAL_CHANNEL)?.({}, "   ")).rejects.toThrow();
    await expect(registrar.listeners.get(SHOW_IN_FOLDER_CHANNEL)?.({}, "   ")).rejects.toThrow();

    expect(shell.openExternal).not.toHaveBeenCalled();
    expect(shell.openPath).not.toHaveBeenCalled();
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
    expect(resolvePath).not.toHaveBeenCalled();
    expect(stat).not.toHaveBeenCalled();
  });
});
