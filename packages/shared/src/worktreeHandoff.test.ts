import { describe, expect, it } from "vitest";

import { hasAssociatedWorktree, resolveWorktreeHandoffIntent } from "./worktreeHandoff";

describe("hasAssociatedWorktree", () => {
  it("treats whitespace-only associated fields as absent", () => {
    expect(
      hasAssociatedWorktree({
        associatedWorktreePath: "   ",
        associatedWorktreeBranch: "\n\t",
        associatedWorktreeRef: "  ",
      }),
    ).toBe(false);
  });

  it("treats quote-wrapped blank associated fields as absent", () => {
    expect(
      hasAssociatedWorktree({
        associatedWorktreePath: ' "   " ',
        associatedWorktreeBranch: " '   ' ",
        associatedWorktreeRef: ' "" ',
      }),
    ).toBe(false);
  });

  it("returns true when any associated field contains non-whitespace text", () => {
    expect(
      hasAssociatedWorktree({
        associatedWorktreePath: "   ",
        associatedWorktreeBranch: " feature/existing ",
      }),
    ).toBe(true);
  });
});

describe("resolveWorktreeHandoffIntent", () => {
  it("prefers create-new when a trimmed worktree name is available", () => {
    expect(
      resolveWorktreeHandoffIntent({
        preferredNewWorktreeName: "  feature/handoff  ",
        associatedWorktreePath: "/repo/.worktrees/existing",
        associatedWorktreeBranch: "feature/existing",
        preferredWorktreeBaseBranch: "  main  ",
        currentBranch: "feature/current",
      }),
    ).toEqual({
      kind: "create-new",
      worktreeName: "feature/handoff",
      baseBranch: "main",
    });
  });

  it("reuses the associated worktree when the preferred name trims to empty", () => {
    expect(
      resolveWorktreeHandoffIntent({
        preferredNewWorktreeName: "  ",
        associatedWorktreePath: "  /repo/.worktrees/existing  ",
        associatedWorktreeBranch: " feature/existing ",
        associatedWorktreeRef: " refs/heads/feature/existing ",
        preferredWorktreeBaseBranch: "release/main",
      }),
    ).toEqual({
      kind: "reuse-associated",
      associatedWorktreePath: "/repo/.worktrees/existing",
      associatedWorktreeBranch: "feature/existing",
      associatedWorktreeRef: "refs/heads/feature/existing",
      baseBranch: "release/main",
    });
  });

  it("falls back to currentBranch when the preferred base branch trims to empty", () => {
    expect(
      resolveWorktreeHandoffIntent({
        preferredNewWorktreeName: "feature/handoff",
        preferredWorktreeBaseBranch: "   ",
        currentBranch: " feature/current ",
      }),
    ).toEqual({
      kind: "create-new",
      worktreeName: "feature/handoff",
      baseBranch: "feature/current",
    });
  });

  it("treats quote-wrapped blank inputs as absent when resolving handoff intent", () => {
    expect(
      resolveWorktreeHandoffIntent({
        preferredNewWorktreeName: ' "   " ',
        associatedWorktreePath: " '   ' ",
        associatedWorktreeBranch: ' "" ',
        associatedWorktreeRef: " '  ' ",
        preferredWorktreeBaseBranch: ' "" ',
        currentBranch: ' "main" ',
      }),
    ).toBeNull();
  });

  it("returns null when both the new name and associated metadata trim to empty", () => {
    expect(
      resolveWorktreeHandoffIntent({
        preferredNewWorktreeName: "   ",
        associatedWorktreePath: "  ",
        associatedWorktreeBranch: "\t",
        associatedWorktreeRef: "\n",
        preferredWorktreeBaseBranch: "main",
      }),
    ).toBeNull();
  });
});
