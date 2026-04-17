import type { DesktopNotificationInput } from "@t3tools/contracts";
import { DesktopNotificationInputSchema } from "@t3tools/contracts";

import type { IpcHandlerRegistrar } from "./ipcHelpers";
import { registerValidatedIpcHandler } from "./ipcHelpers";

export const NOTIFICATIONS_SHOW_CHANNEL = "desktop:notifications-show";

export function registerDesktopNotificationShowHandler(input: {
  ipc: IpcHandlerRegistrar;
  isDevelopment: boolean;
  showNotification: (payload: DesktopNotificationInput) => boolean | Promise<boolean>;
}): void {
  registerValidatedIpcHandler(
    input.ipc,
    NOTIFICATIONS_SHOW_CHANNEL,
    DesktopNotificationInputSchema,
    input.showNotification,
    {
      rejectUnknownFieldsInDevelopment: true,
      isDevelopment: input.isDevelopment,
    },
  );
}
