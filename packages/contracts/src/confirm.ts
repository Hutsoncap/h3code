import { TrimmedNonEmptyString } from "./baseSchemas";

export const DesktopConfirmMessageSchema = TrimmedNonEmptyString;
export type DesktopConfirmMessage = typeof DesktopConfirmMessageSchema.Type;
