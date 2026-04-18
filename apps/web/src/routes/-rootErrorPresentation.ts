import { trimOrNull } from "@t3tools/shared/model";

export function rootErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = trimOrNull(error.message);
    if (message) {
      return message;
    }
  }

  if (typeof error === "string") {
    const message = trimOrNull(error);
    if (message) {
      return message;
    }
  }

  return "An unexpected router error occurred.";
}

export function rootErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return "No additional error details are available.";
  }
}
