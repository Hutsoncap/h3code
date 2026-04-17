import { Schema } from "effect";
import {
  DesktopUpdateActionResultSchema,
  DesktopUpdateStateSchema,
  type DesktopUpdateActionResult,
  type DesktopUpdateState,
} from "@t3tools/contracts";

import { registerValidatedIpcEndpoint, type IpcHandlerRegistrar } from "./ipcHelpers";

const UPDATE_GET_STATE_CHANNEL = "desktop:update-get-state";
const UPDATE_CHECK_CHANNEL = "desktop:update-check";
const UPDATE_DOWNLOAD_CHANNEL = "desktop:update-download";
const UPDATE_INSTALL_CHANNEL = "desktop:update-install";

type DesktopUpdateAction = {
  accepted: boolean;
  completed: boolean;
};

type RegisterDesktopUpdateIpcHandlersInput = {
  ipc: IpcHandlerRegistrar;
  isDevelopment: boolean;
  getUpdateState: () => DesktopUpdateState;
  checkForUpdates: (reason: "renderer") => Promise<void>;
  downloadAvailableUpdate: () => Promise<DesktopUpdateAction>;
  installDownloadedUpdate: () => Promise<DesktopUpdateAction>;
  getIsQuitting: () => boolean;
};

function buildActionResult(input: {
  action: DesktopUpdateAction;
  state: DesktopUpdateState;
}): DesktopUpdateActionResult {
  return {
    accepted: input.action.accepted,
    completed: input.action.completed,
    state: input.state,
  };
}

export function registerDesktopUpdateIpcHandlers(
  input: RegisterDesktopUpdateIpcHandlersInput,
): void {
  const options = {
    rejectUnknownFieldsInDevelopment: true,
    isDevelopment: input.isDevelopment,
  } as const;

  registerValidatedIpcEndpoint(
    input.ipc,
    UPDATE_GET_STATE_CHANNEL,
    Schema.Undefined,
    DesktopUpdateStateSchema,
    async () => input.getUpdateState(),
    options,
  );

  registerValidatedIpcEndpoint(
    input.ipc,
    UPDATE_CHECK_CHANNEL,
    Schema.Undefined,
    DesktopUpdateStateSchema,
    async () => {
      await input.checkForUpdates("renderer");
      return input.getUpdateState();
    },
    options,
  );

  registerValidatedIpcEndpoint(
    input.ipc,
    UPDATE_DOWNLOAD_CHANNEL,
    Schema.Undefined,
    DesktopUpdateActionResultSchema,
    async () =>
      buildActionResult({
        action: await input.downloadAvailableUpdate(),
        state: input.getUpdateState(),
      }),
    options,
  );

  registerValidatedIpcEndpoint(
    input.ipc,
    UPDATE_INSTALL_CHANNEL,
    Schema.Undefined,
    DesktopUpdateActionResultSchema,
    async () => {
      if (input.getIsQuitting()) {
        return buildActionResult({
          action: { accepted: false, completed: false },
          state: input.getUpdateState(),
        });
      }

      return buildActionResult({
        action: await input.installDownloadedUpdate(),
        state: input.getUpdateState(),
      });
    },
    options,
  );
}
