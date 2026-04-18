import { trimOrNull } from "@t3tools/shared/model";

export function toBranchActionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return trimOrNull(error.message) ?? "An error occurred.";
  }
  if (typeof error === "string") {
    return trimOrNull(error) ?? "An error occurred.";
  }
  return "An error occurred.";
}
