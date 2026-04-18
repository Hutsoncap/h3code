import type { ThreadEnvironmentMode } from "@t3tools/contracts";

export type ResolvedThreadWorkspaceState = "local" | "worktree-pending" | "worktree-ready";

function hasMaterializedWorktreePath(
  worktreePath: string | null | undefined,
): worktreePath is string {
  const trimmed = worktreePath?.trim() ?? "";
  if (trimmed.length === 0) {
    return false;
  }

  if (trimmed.length >= 2) {
    const quote = trimmed[0];
    if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
      return trimmed.slice(1, -1).trim().length > 0;
    }
  }

  return true;
}

export function resolveThreadEnvironmentMode(input: {
  envMode?: ThreadEnvironmentMode | null | undefined;
  worktreePath?: string | null | undefined;
}): ThreadEnvironmentMode {
  if (hasMaterializedWorktreePath(input.worktreePath)) {
    return "worktree";
  }
  return input.envMode ?? "local";
}

export function resolveThreadWorkspaceState(input: {
  envMode?: ThreadEnvironmentMode | null | undefined;
  worktreePath?: string | null | undefined;
}): ResolvedThreadWorkspaceState {
  const mode = resolveThreadEnvironmentMode(input);
  if (mode === "local") {
    return "local";
  }
  return hasMaterializedWorktreePath(input.worktreePath) ? "worktree-ready" : "worktree-pending";
}

export function isPendingThreadWorktree(input: {
  envMode?: ThreadEnvironmentMode | null | undefined;
  worktreePath?: string | null | undefined;
}): boolean {
  return resolveThreadWorkspaceState(input) === "worktree-pending";
}

// Runtime-facing operations should only target a materialized worktree path.
export function resolveThreadWorkspaceCwd(input: {
  projectCwd?: string | null | undefined;
  envMode?: ThreadEnvironmentMode | null | undefined;
  worktreePath?: string | null | undefined;
}): string | null {
  const mode = resolveThreadEnvironmentMode(input);
  if (mode === "worktree") {
    return hasMaterializedWorktreePath(input.worktreePath) ? input.worktreePath : null;
  }
  return input.projectCwd ?? null;
}

// Branch discovery can still use the project root before a worktree exists.
export function resolveThreadBranchSourceCwd(input: {
  projectCwd?: string | null | undefined;
  worktreePath?: string | null | undefined;
}): string | null {
  return hasMaterializedWorktreePath(input.worktreePath)
    ? input.worktreePath
    : (input.projectCwd ?? null);
}
