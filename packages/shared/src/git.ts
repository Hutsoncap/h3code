/**
 * Sanitize an arbitrary string into a valid, lowercase git branch fragment.
 * Strips quotes, collapses separators, limits to 64 chars.
 */
export const WORKTREE_BRANCH_PREFIX = "h3code";
const LEGACY_WORKTREE_BRANCH_PREFIXES = ["dpcode"] as const;
const TEMP_WORKTREE_BRANCH_PREFIXES = [
  WORKTREE_BRANCH_PREFIX,
  ...LEGACY_WORKTREE_BRANCH_PREFIXES,
] as const;
const TEMP_WORKTREE_BRANCH_PATTERNS = TEMP_WORKTREE_BRANCH_PREFIXES.map(
  (prefix) => new RegExp(`^${prefix}\\/[0-9a-f]{8}$`),
);

function normalizeTemporaryWorktreeBranch(branch: string): string {
  return branch
    .trim()
    .toLowerCase()
    .replace(/^refs\/heads\//, "")
    .replace(/['"`]/g, "");
}

export function sanitizeBranchFragment(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/^[./\s_-]+|[./\s_-]+$/g, "");

  const branchFragment = normalized
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/-+/g, "-")
    .replace(/^[./_-]+|[./_-]+$/g, "")
    .slice(0, 64)
    .replace(/[./_-]+$/g, "");

  return branchFragment.length > 0 ? branchFragment : "update";
}

/**
 * Sanitize a string into a `feature/…` branch name.
 * Preserves an existing `feature/` prefix or slash-separated namespace.
 */
export function sanitizeFeatureBranchName(raw: string): string {
  const sanitized = sanitizeBranchFragment(raw);
  if (sanitized.includes("/")) {
    return sanitized.startsWith("feature/") ? sanitized : `feature/${sanitized}`;
  }
  return `feature/${sanitized}`;
}

const AUTO_FEATURE_BRANCH_FALLBACK = "feature/update";

/**
 * Resolve a unique `feature/…` branch name that doesn't collide with
 * any existing branch. Appends a numeric suffix when needed.
 */
export function resolveAutoFeatureBranchName(
  existingBranchNames: readonly string[],
  preferredBranch?: string,
): string {
  const preferred = preferredBranch?.trim();
  const resolvedBase = sanitizeFeatureBranchName(
    preferred && preferred.length > 0 ? preferred : AUTO_FEATURE_BRANCH_FALLBACK,
  );
  const existingNames = new Set(existingBranchNames.map((branch) => branch.toLowerCase()));

  if (!existingNames.has(resolvedBase)) {
    return resolvedBase;
  }

  let suffix = 2;
  while (existingNames.has(`${resolvedBase}-${suffix}`)) {
    suffix += 1;
  }

  return `${resolvedBase}-${suffix}`;
}

export function isTemporaryWorktreeBranch(branch: string): boolean {
  const normalized = normalizeTemporaryWorktreeBranch(branch);
  return TEMP_WORKTREE_BRANCH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildTemporaryWorktreeBranchName(): string {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toLowerCase();
  return `${WORKTREE_BRANCH_PREFIX}/${token}`;
}

export function stripTemporaryWorktreeBranchPrefix(branch: string): string {
  const normalized = normalizeTemporaryWorktreeBranch(branch);

  for (const prefix of TEMP_WORKTREE_BRANCH_PREFIXES) {
    const prefixWithSlash = `${prefix}/`;
    if (normalized.startsWith(prefixWithSlash)) {
      return normalized.slice(prefixWithSlash.length);
    }
  }

  return normalized;
}

// Preserve semantic thread branches when transient worktree placeholders briefly
// appear in git status during rename/bootstrap transitions.
export function resolveThreadBranchRegressionGuard(input: {
  currentBranch: string | null;
  nextBranch: string | null;
}): string | null {
  if (
    input.currentBranch !== null &&
    input.nextBranch !== null &&
    !isTemporaryWorktreeBranch(input.currentBranch) &&
    isTemporaryWorktreeBranch(input.nextBranch)
  ) {
    return input.currentBranch;
  }

  return input.nextBranch;
}
