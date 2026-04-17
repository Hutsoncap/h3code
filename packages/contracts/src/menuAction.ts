import { Schema } from "effect";

import { ThreadId } from "./baseSchemas";

const DesktopMenuActionStatic = Schema.Literals([
  "toggle-sidebar",
  "open-settings",
  "toggle-browser",
  "new-terminal-tab",
]);

const NotificationOpenThreadAction = Schema.TemplateLiteral([
  Schema.Literal("notification-open-thread:"),
  ThreadId,
]);

export const DesktopMenuAction = Schema.Union([
  DesktopMenuActionStatic,
  NotificationOpenThreadAction,
]);
export type DesktopMenuAction = typeof DesktopMenuAction.Type;
