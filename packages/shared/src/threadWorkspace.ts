// FILE: threadWorkspace.ts
// Purpose: Share worktree and workspace-root helpers used across web and server flows.
// Layer: Shared util
// Exports: associated worktree helpers plus workspace-root comparison helpers

export interface AssociatedWorktreeMetadata {
  associatedWorktreePath: string | null;
  associatedWorktreeBranch: string | null;
  associatedWorktreeRef: string | null;
}

export interface AssociatedWorktreeMetadataPatch {
  associatedWorktreePath?: string | null;
  associatedWorktreeBranch?: string | null;
  associatedWorktreeRef?: string | null;
}

export interface NormalizeWorkspaceRootForComparisonOptions {
  readonly platform?: string;
}

function normalizeOptionalMetadataValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length >= 2) {
    const quote = trimmed[0];
    if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
      const unquoted = trimmed.slice(1, -1).trim();
      if (unquoted.length === 0) {
        return null;
      }
    }
  }

  return trimmed;
}

function isLikelyWindowsWorkspaceRoot(value: string, platform?: string): boolean {
  if (platform === "win32") {
    return true;
  }
  if (platform && platform !== "win32") {
    return false;
  }
  return /^[a-z]:([\\/]|$)/i.test(value) || value.startsWith("\\\\") || value.startsWith("//");
}

// Normalizes import-path identity without changing the original stored display path.
export function normalizeWorkspaceRootForComparison(
  value: string,
  options?: NormalizeWorkspaceRootForComparisonOptions,
): string {
  const trimmed = normalizeOptionalMetadataValue(value) ?? "";
  if (trimmed.length === 0) {
    return "";
  }

  const withForwardSlashes = trimmed.replace(/\\/g, "/");
  const hasUncPrefix = withForwardSlashes.startsWith("//");
  const prefix = hasUncPrefix ? "//" : withForwardSlashes.startsWith("/") ? "/" : "";
  const body = withForwardSlashes.slice(prefix.length).replace(/\/+/g, "/");
  const normalized =
    prefix.length > 0 ? `${prefix}${body.replace(/\/+$/g, "")}` : body.replace(/\/+$/g, "");
  const finalValue = normalized.length > 0 ? normalized : prefix;

  if (isLikelyWindowsWorkspaceRoot(trimmed, options?.platform)) {
    return finalValue.toLowerCase();
  }
  return finalValue;
}

export function workspaceRootsEqual(
  left: string,
  right: string,
  options?: NormalizeWorkspaceRootForComparisonOptions,
): boolean {
  return (
    normalizeWorkspaceRootForComparison(left, options) ===
    normalizeWorkspaceRootForComparison(right, options)
  );
}

export function deriveAssociatedWorktreeMetadata(input: {
  branch?: string | null;
  worktreePath?: string | null;
  associatedWorktreePath?: string | null;
  associatedWorktreeBranch?: string | null;
  associatedWorktreeRef?: string | null;
}): AssociatedWorktreeMetadata {
  const materializedWorktreePath = normalizeOptionalMetadataValue(input.worktreePath);
  const normalizedBranch = normalizeOptionalMetadataValue(input.branch);
  const associatedWorktreePath = normalizeOptionalMetadataValue(input.associatedWorktreePath);
  const associatedWorktreeBranch = normalizeOptionalMetadataValue(input.associatedWorktreeBranch);
  const associatedWorktreeRef = normalizeOptionalMetadataValue(input.associatedWorktreeRef);

  return {
    associatedWorktreePath:
      input.associatedWorktreePath !== undefined
        ? associatedWorktreePath
        : materializedWorktreePath,
    associatedWorktreeBranch:
      input.associatedWorktreeBranch !== undefined
        ? associatedWorktreeBranch
        : materializedWorktreePath
          ? normalizedBranch
          : null,
    associatedWorktreeRef:
      input.associatedWorktreeRef !== undefined
        ? associatedWorktreeRef
        : input.associatedWorktreeBranch !== undefined
          ? associatedWorktreeBranch
          : materializedWorktreePath
            ? normalizedBranch
            : null,
  };
}

export function deriveAssociatedWorktreeMetadataPatch(input: {
  branch?: string | null;
  worktreePath?: string | null;
  associatedWorktreePath?: string | null;
  associatedWorktreeBranch?: string | null;
  associatedWorktreeRef?: string | null;
}): AssociatedWorktreeMetadataPatch {
  const patch: AssociatedWorktreeMetadataPatch = {};
  const materializedWorktreePath = normalizeOptionalMetadataValue(input.worktreePath);
  const normalizedBranch = normalizeOptionalMetadataValue(input.branch);
  const associatedWorktreePath = normalizeOptionalMetadataValue(input.associatedWorktreePath);
  const associatedWorktreeBranch = normalizeOptionalMetadataValue(input.associatedWorktreeBranch);
  const associatedWorktreeRef = normalizeOptionalMetadataValue(input.associatedWorktreeRef);

  if (input.associatedWorktreePath !== undefined) {
    patch.associatedWorktreePath = associatedWorktreePath;
  } else if (materializedWorktreePath) {
    patch.associatedWorktreePath = materializedWorktreePath;
  }

  if (input.associatedWorktreeBranch !== undefined) {
    patch.associatedWorktreeBranch = associatedWorktreeBranch;
  } else if (materializedWorktreePath) {
    patch.associatedWorktreeBranch = normalizedBranch;
  }

  if (input.associatedWorktreeRef !== undefined) {
    patch.associatedWorktreeRef = associatedWorktreeRef;
  } else if (input.associatedWorktreeBranch !== undefined) {
    patch.associatedWorktreeRef = associatedWorktreeBranch;
  } else if (materializedWorktreePath) {
    patch.associatedWorktreeRef = normalizedBranch;
  }

  return patch;
}
