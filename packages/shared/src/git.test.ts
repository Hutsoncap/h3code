import { describe, expect, it } from "vitest";

import {
  WORKTREE_BRANCH_PREFIX,
  buildTemporaryWorktreeBranchName,
  isTemporaryWorktreeBranch,
  resolveThreadBranchRegressionGuard,
  stripTemporaryWorktreeBranchPrefix,
} from "./git";

describe("isTemporaryWorktreeBranch", () => {
  it("matches generated temporary worktree branches", () => {
    expect(buildTemporaryWorktreeBranchName()).toMatch(/^h3code\/[0-9a-f]{8}$/);
    expect(isTemporaryWorktreeBranch(buildTemporaryWorktreeBranchName())).toBe(true);
  });

  it("matches canonical temporary worktree branches", () => {
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/deadbeef`)).toBe(true);
    expect(isTemporaryWorktreeBranch(` ${WORKTREE_BRANCH_PREFIX}/DEADBEEF `)).toBe(true);
  });

  it("matches legacy temporary worktree branches during the alias window", () => {
    expect(isTemporaryWorktreeBranch("dpcode/deadbeef")).toBe(true);
    expect(isTemporaryWorktreeBranch(" dpcode/DEADBEEF ")).toBe(true);
  });

  it("rejects semantic branch names", () => {
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/feature/demo`)).toBe(false);
    expect(isTemporaryWorktreeBranch("feature/demo")).toBe(false);
  });
});

describe("stripTemporaryWorktreeBranchPrefix", () => {
  it("strips the canonical temporary worktree prefix", () => {
    expect(stripTemporaryWorktreeBranchPrefix("refs/heads/h3code/deadbeef")).toBe("deadbeef");
  });

  it("strips the legacy temporary worktree prefix", () => {
    expect(stripTemporaryWorktreeBranchPrefix("dpcode/Feature-Demo")).toBe("feature-demo");
  });

  it("leaves semantic branches intact", () => {
    expect(stripTemporaryWorktreeBranchPrefix("feature/demo")).toBe("feature/demo");
  });
});

describe("resolveThreadBranchRegressionGuard", () => {
  it("keeps a semantic branch when the next branch is only a temporary worktree placeholder", () => {
    expect(
      resolveThreadBranchRegressionGuard({
        currentBranch: "feature/semantic-branch",
        nextBranch: `${WORKTREE_BRANCH_PREFIX}/deadbeef`,
      }),
    ).toBe("feature/semantic-branch");
  });

  it("accepts real branch changes", () => {
    expect(
      resolveThreadBranchRegressionGuard({
        currentBranch: "feature/old",
        nextBranch: "feature/new",
      }),
    ).toBe("feature/new");
  });

  it("allows clearing the branch", () => {
    expect(
      resolveThreadBranchRegressionGuard({
        currentBranch: "feature/old",
        nextBranch: null,
      }),
    ).toBeNull();
  });
});
