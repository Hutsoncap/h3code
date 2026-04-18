export type WorktreeHandoffIntent =
  | {
      kind: "create-new";
      worktreeName: string;
      baseBranch: string | null;
    }
  | {
      kind: "reuse-associated";
      associatedWorktreePath: string | null;
      associatedWorktreeBranch: string | null;
      associatedWorktreeRef: string | null;
      baseBranch: string | null;
    };

function normalizeOptionalString(value?: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function hasAssociatedWorktree(input: {
  associatedWorktreePath?: string | null;
  associatedWorktreeBranch?: string | null;
  associatedWorktreeRef?: string | null;
}): boolean {
  return Boolean(
    normalizeOptionalString(input.associatedWorktreePath) ??
    normalizeOptionalString(input.associatedWorktreeBranch) ??
    normalizeOptionalString(input.associatedWorktreeRef),
  );
}

export function resolveWorktreeHandoffIntent(input: {
  preferredNewWorktreeName?: string | null;
  associatedWorktreePath?: string | null;
  associatedWorktreeBranch?: string | null;
  associatedWorktreeRef?: string | null;
  preferredWorktreeBaseBranch?: string | null;
  currentBranch?: string | null;
}): WorktreeHandoffIntent | null {
  const normalizedWorktreeName = normalizeOptionalString(input.preferredNewWorktreeName);
  const baseBranch =
    normalizeOptionalString(input.preferredWorktreeBaseBranch) ??
    normalizeOptionalString(input.currentBranch);

  if (normalizedWorktreeName) {
    return {
      kind: "create-new",
      worktreeName: normalizedWorktreeName,
      baseBranch,
    };
  }

  if (!hasAssociatedWorktree(input)) {
    return null;
  }

  return {
    kind: "reuse-associated",
    associatedWorktreePath: normalizeOptionalString(input.associatedWorktreePath),
    associatedWorktreeBranch: normalizeOptionalString(input.associatedWorktreeBranch),
    associatedWorktreeRef: normalizeOptionalString(input.associatedWorktreeRef),
    baseBranch,
  };
}
