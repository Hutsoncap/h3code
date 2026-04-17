import { Schema } from "effect";
import { type DesktopNotificationInput, DesktopNotificationInputSchema } from "@t3tools/contracts";

const decodeDesktopNotificationInput = Schema.decodeUnknownSync(DesktopNotificationInputSchema);

export function parseDesktopNotificationInput(input: unknown): DesktopNotificationInput {
  return decodeDesktopNotificationInput(input);
}
