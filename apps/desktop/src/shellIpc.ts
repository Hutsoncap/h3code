import * as FS from "node:fs";
import * as Path from "node:path";

import type {
  DesktopShellOpenExternalInput,
  DesktopShellShowInFolderInput,
} from "@t3tools/contracts";
import {
  DesktopShellOpenExternalInputSchema,
  DesktopShellShowInFolderInputSchema,
} from "@t3tools/contracts";

import { registerValidatedIpcHandler, type IpcHandlerRegistrar } from "./ipcHelpers";

export const OPEN_EXTERNAL_CHANNEL = "desktop:open-external";
export const SHOW_IN_FOLDER_CHANNEL = "desktop:show-in-folder";

type DesktopShellDependencies = {
  openExternal: (url: string) => Promise<void>;
  openPath: (path: string) => Promise<string>;
  showItemInFolder: (path: string) => void;
};

type DesktopShellStat = Pick<FS.Stats, "isDirectory">;

type ShowInFolderDependencies = {
  stat: (path: string) => Promise<DesktopShellStat>;
  resolvePath: (path: string) => string;
} & Pick<DesktopShellDependencies, "openPath" | "showItemInFolder">;

type RegisterDesktopShellIpcHandlersInput = {
  ipc: IpcHandlerRegistrar;
  shell: DesktopShellDependencies;
  stat?: (path: string) => Promise<DesktopShellStat>;
  resolvePath?: (path: string) => string;
};

export function getSafeExternalUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return null;
  }

  return parsedUrl.toString();
}

export async function handleDesktopShellOpenExternal(
  rawUrl: DesktopShellOpenExternalInput,
  dependencies: Pick<DesktopShellDependencies, "openExternal">,
): Promise<boolean> {
  const externalUrl = getSafeExternalUrl(rawUrl);
  if (!externalUrl) {
    return false;
  }

  try {
    await dependencies.openExternal(externalUrl);
    return true;
  } catch {
    return false;
  }
}

export async function handleDesktopShellShowInFolder(
  rawPath: DesktopShellShowInFolderInput,
  dependencies: ShowInFolderDependencies,
): Promise<void> {
  if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
    throw new Error("Missing folder path.");
  }

  const resolvedPath = dependencies.resolvePath(rawPath);

  let stats: DesktopShellStat;
  try {
    stats = await dependencies.stat(resolvedPath);
  } catch {
    throw new Error(`Folder not found: ${resolvedPath}`);
  }

  if (stats.isDirectory()) {
    const errorMessage = await dependencies.openPath(resolvedPath);
    if (errorMessage.trim().length > 0) {
      throw new Error(errorMessage);
    }
    return;
  }

  dependencies.showItemInFolder(resolvedPath);
}

export function registerDesktopShellIpcHandlers(input: RegisterDesktopShellIpcHandlersInput): void {
  registerValidatedIpcHandler(
    input.ipc,
    OPEN_EXTERNAL_CHANNEL,
    DesktopShellOpenExternalInputSchema,
    async (rawUrl) =>
      handleDesktopShellOpenExternal(rawUrl, {
        openExternal: input.shell.openExternal,
      }),
  );

  registerValidatedIpcHandler(
    input.ipc,
    SHOW_IN_FOLDER_CHANNEL,
    DesktopShellShowInFolderInputSchema,
    async (rawPath) =>
      handleDesktopShellShowInFolder(rawPath, {
        openPath: input.shell.openPath,
        showItemInFolder: input.shell.showItemInFolder,
        stat: input.stat ?? ((path) => FS.promises.stat(path)),
        resolvePath: input.resolvePath ?? Path.resolve,
      }),
  );
}
