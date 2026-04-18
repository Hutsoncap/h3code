import { describe, expect, it } from "vitest";

import {
  deriveAssociatedWorktreeMetadata,
  deriveAssociatedWorktreeMetadataPatch,
  normalizeWorkspaceRootForComparison,
  workspaceRootsEqual,
} from "./threadWorkspace";

describe("normalizeWorkspaceRootForComparison", () => {
  it("trims and collapses repeated separators without changing the stored path shape", () => {
    expect(normalizeWorkspaceRootForComparison("  /repo//worktree///  ")).toBe("/repo/worktree");
  });

  it("lowercases and normalizes windows roots when the platform is win32", () => {
    expect(
      normalizeWorkspaceRootForComparison(" C:\\Repo\\Worktree\\ ", { platform: "win32" }),
    ).toBe("c:/repo/worktree");
  });
});

describe("workspaceRootsEqual", () => {
  it("treats normalized windows roots as equal across case and slash differences", () => {
    expect(
      workspaceRootsEqual("C:\\Repo\\Worktree", "c:/repo//worktree/", { platform: "win32" }),
    ).toBe(true);
  });

  it("keeps distinct roots unequal after normalization", () => {
    expect(workspaceRootsEqual("/repo/one", "/repo/two")).toBe(false);
  });
});

describe("deriveAssociatedWorktreeMetadata", () => {
  it("prefers explicit associated worktree fields over worktree-derived fallbacks", () => {
    expect(
      deriveAssociatedWorktreeMetadata({
        branch: "feature/base",
        worktreePath: "/repo/.worktrees/fallback",
        associatedWorktreePath: "/repo/.worktrees/explicit",
        associatedWorktreeBranch: "feature/explicit",
        associatedWorktreeRef: "refs/heads/explicit",
      }),
    ).toEqual({
      associatedWorktreePath: "/repo/.worktrees/explicit",
      associatedWorktreeBranch: "feature/explicit",
      associatedWorktreeRef: "refs/heads/explicit",
    });
  });

  it("preserves an explicit null branch and reflects it in the derived ref", () => {
    expect(
      deriveAssociatedWorktreeMetadata({
        branch: "feature/base",
        worktreePath: "/repo/.worktrees/feature",
        associatedWorktreeBranch: null,
      }),
    ).toEqual({
      associatedWorktreePath: "/repo/.worktrees/feature",
      associatedWorktreeBranch: null,
      associatedWorktreeRef: null,
    });
  });

  it("treats whitespace-only worktree paths as absent", () => {
    expect(
      deriveAssociatedWorktreeMetadata({
        branch: "feature/base",
        worktreePath: "   ",
      }),
    ).toEqual({
      associatedWorktreePath: null,
      associatedWorktreeBranch: null,
      associatedWorktreeRef: null,
    });
  });

  it("treats quote-wrapped blank worktree metadata as absent", () => {
    expect(
      deriveAssociatedWorktreeMetadata({
        branch: "feature/base",
        worktreePath: ' "   " ',
        associatedWorktreePath: " '   ' ",
        associatedWorktreeBranch: ' "" ',
        associatedWorktreeRef: " '  ' ",
      }),
    ).toEqual({
      associatedWorktreePath: null,
      associatedWorktreeBranch: null,
      associatedWorktreeRef: null,
    });
  });

  it("treats quote-wrapped blank fallback branches as absent when a worktree path exists", () => {
    expect(
      deriveAssociatedWorktreeMetadata({
        branch: ' "   " ',
        worktreePath: "/repo/.worktrees/feature",
      }),
    ).toEqual({
      associatedWorktreePath: "/repo/.worktrees/feature",
      associatedWorktreeBranch: null,
      associatedWorktreeRef: null,
    });
  });
});

describe("deriveAssociatedWorktreeMetadataPatch", () => {
  it("prefers explicit patch values over worktree-derived fallbacks", () => {
    expect(
      deriveAssociatedWorktreeMetadataPatch({
        branch: "feature/base",
        worktreePath: "/repo/.worktrees/fallback",
        associatedWorktreePath: "/repo/.worktrees/explicit",
        associatedWorktreeBranch: "feature/explicit",
        associatedWorktreeRef: "refs/heads/explicit",
      }),
    ).toEqual({
      associatedWorktreePath: "/repo/.worktrees/explicit",
      associatedWorktreeBranch: "feature/explicit",
      associatedWorktreeRef: "refs/heads/explicit",
    });
  });

  it("keeps explicit nulls and does not backfill from worktreePath", () => {
    expect(
      deriveAssociatedWorktreeMetadataPatch({
        branch: "feature/base",
        worktreePath: "/repo/.worktrees/feature",
        associatedWorktreePath: null,
        associatedWorktreeBranch: null,
      }),
    ).toEqual({
      associatedWorktreePath: null,
      associatedWorktreeBranch: null,
      associatedWorktreeRef: null,
    });
  });

  it("ignores whitespace-only worktree paths when building the patch", () => {
    expect(
      deriveAssociatedWorktreeMetadataPatch({
        branch: "feature/base",
        worktreePath: "   ",
      }),
    ).toEqual({});
  });

  it("normalizes quote-wrapped blank explicit patch fields to null", () => {
    expect(
      deriveAssociatedWorktreeMetadataPatch({
        branch: "feature/base",
        associatedWorktreePath: ' "   " ',
        associatedWorktreeBranch: " '   ' ",
        associatedWorktreeRef: ' "" ',
      }),
    ).toEqual({
      associatedWorktreePath: null,
      associatedWorktreeBranch: null,
      associatedWorktreeRef: null,
    });
  });
});
