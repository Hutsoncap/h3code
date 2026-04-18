// FILE: threadEnvironment.ts
// Purpose: Shared helpers for deriving thread environment intent and fork targets.
// Layer: Web domain helpers
// Exports: thread env resolution + `/fork` target planning

import type { ThreadEnvironmentMode } from "@t3tools/contracts";
import {
  isPendingThreadWorktree,
  resolveThreadEnvironmentMode,
  resolveThreadWorkspaceCwd,
  resolveThreadWorkspaceState,
  type ResolvedThreadWorkspaceState,
} from "@t3tools/shared/threadEnvironment";
import { deriveAssociatedWorktreeMetadata } from "@t3tools/shared/threadWorkspace";
import type { Thread } from "../types";

export type ForkThreadTarget = "local" | "worktree";

export interface ResolvedForkThreadEnvironment {
  target: ForkThreadTarget;
  envMode: ThreadEnvironmentMode;
  branch: string | null;
  worktreePath: string | null;
  associatedWorktreePath: string | null;
  associatedWorktreeBranch: string | null;
  associatedWorktreeRef: string | null;
}

export {
  isPendingThreadWorktree,
  resolveThreadEnvironmentMode,
  resolveThreadWorkspaceState,
} from "@t3tools/shared/threadEnvironment";

export interface ThreadEnvironmentPresentation {
  mode: ThreadEnvironmentMode;
  workspaceState: ResolvedThreadWorkspaceState;
  shortLabel: "Local" | "Worktree";
  localOptionLabel: "Local project";
  worktreeOptionLabel: "Worktree";
  worktreeBadgeLabel: "Worktree" | "Worktree pending" | null;
}

export function resolveThreadEnvironmentPresentation(input: {
  envMode?: ThreadEnvironmentMode | null | undefined;
  worktreePath?: string | null | undefined;
}): ThreadEnvironmentPresentation {
  const mode = resolveThreadEnvironmentMode(input);
  const workspaceState = resolveThreadWorkspaceState(input);

  return {
    mode,
    workspaceState,
    shortLabel: mode === "worktree" ? "Worktree" : "Local",
    localOptionLabel: "Local project",
    worktreeOptionLabel: "Worktree",
    worktreeBadgeLabel:
      workspaceState === "worktree-ready"
        ? "Worktree"
        : workspaceState === "worktree-pending"
          ? "Worktree pending"
          : null,
  };
}

export interface DiffEnvironmentState {
  pending: boolean;
  cwd: string | null;
  disabledReason: string | null;
}

function normalizeThreadContextValue(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  if (normalized.length >= 2) {
    const quote = normalized[0];
    if ((quote === '"' || quote === "'") && normalized.at(-1) === quote) {
      const unquoted = normalized.slice(1, -1).trim();
      if (!unquoted) {
        return null;
      }
    }
  }

  return normalized;
}

// Diff surfaces stay disabled while a worktree-intended chat is still waiting for its path.
export function resolveDiffEnvironmentState(input: {
  projectCwd?: string | null | undefined;
  envMode?: ThreadEnvironmentMode | null | undefined;
  worktreePath?: string | null | undefined;
}): DiffEnvironmentState {
  const pending = isPendingThreadWorktree(input);
  return {
    pending,
    cwd: pending
      ? null
      : resolveThreadWorkspaceCwd({
          projectCwd: input.projectCwd,
          envMode: input.envMode,
          worktreePath: input.worktreePath,
        }),
    disabledReason: pending
      ? "Diff and summary will be available once the worktree is ready for this chat."
      : null,
  };
}

// Fork planning keeps "local" attached to the current local checkout. For worktree-backed
// threads that means reusing the existing worktree, while "worktree" always plans a new one.
export function resolveForkThreadEnvironment(input: {
  target: ForkThreadTarget;
  activeRootBranch: string | null;
  sourceThread: Pick<
    Thread,
    | "branch"
    | "envMode"
    | "worktreePath"
    | "associatedWorktreePath"
    | "associatedWorktreeBranch"
    | "associatedWorktreeRef"
  >;
}): ResolvedForkThreadEnvironment {
  const sourceEnvMode = resolveThreadEnvironmentMode({
    envMode: input.sourceThread.envMode,
    worktreePath: input.sourceThread.worktreePath,
  });
  const sourceBranch =
    normalizeThreadContextValue(input.sourceThread.branch) ??
    normalizeThreadContextValue(input.activeRootBranch);
  const sourceWorktreePath = normalizeThreadContextValue(input.sourceThread.worktreePath);
  const sourceAssociatedWorktreePath =
    normalizeThreadContextValue(input.sourceThread.associatedWorktreePath) ?? sourceWorktreePath;
  const sourceAssociatedWorktreeBranch =
    normalizeThreadContextValue(input.sourceThread.associatedWorktreeBranch) ?? sourceBranch;
  const sourceAssociatedWorktreeRef =
    normalizeThreadContextValue(input.sourceThread.associatedWorktreeRef) ??
    sourceAssociatedWorktreeBranch;

  if (input.target === "worktree") {
    const associatedWorktree = deriveAssociatedWorktreeMetadata({
      associatedWorktreePath: null,
      associatedWorktreeBranch: sourceBranch,
      associatedWorktreeRef: sourceAssociatedWorktreeRef ?? sourceBranch,
    });
    return {
      target: "worktree",
      envMode: "worktree",
      branch: sourceBranch,
      worktreePath: null,
      ...associatedWorktree,
    };
  }

  // Codex-style "Fork Into Local" stays in the current local checkout, which for a
  // worktree-backed thread means reusing that worktree rather than bouncing to root.
  if (sourceEnvMode === "worktree" && sourceWorktreePath) {
    const associatedWorktree = deriveAssociatedWorktreeMetadata({
      branch: sourceBranch,
      worktreePath: sourceWorktreePath,
      associatedWorktreePath: sourceAssociatedWorktreePath,
      associatedWorktreeBranch: sourceAssociatedWorktreeBranch,
      associatedWorktreeRef: sourceAssociatedWorktreeRef,
    });
    return {
      target: "local",
      envMode: "worktree",
      branch: sourceBranch,
      worktreePath: sourceWorktreePath,
      ...associatedWorktree,
    };
  }

  const associatedWorktree = deriveAssociatedWorktreeMetadata({
    associatedWorktreePath: null,
    associatedWorktreeBranch: null,
    associatedWorktreeRef: null,
  });
  return {
    target: "local",
    envMode: "local",
    branch: sourceBranch,
    worktreePath: null,
    ...associatedWorktree,
  };
}
