import { Encoding } from "effect";
import { describe, expect, it } from "vitest";
import { ProjectId, ThreadId } from "@t3tools/contracts";

import {
  CHECKPOINT_REFS_PREFIX,
  checkpointRefForThreadTurn,
  resolveThreadWorkspaceCwd,
} from "./Utils.ts";

describe("checkpointRefForThreadTurn", () => {
  it("encodes thread ids into the canonical checkpoint ref shape", () => {
    const threadId = ThreadId.makeUnsafe("thread/with spaces");

    expect(checkpointRefForThreadTurn(threadId, 7)).toBe(
      `${CHECKPOINT_REFS_PREFIX}/${Encoding.encodeBase64Url(threadId)}/turn/7`,
    );
  });
});

describe("resolveThreadWorkspaceCwd", () => {
  it("uses the matching project workspace root for local threads", () => {
    const projectId = ProjectId.makeUnsafe("project-1");

    expect(
      resolveThreadWorkspaceCwd({
        thread: {
          projectId,
          envMode: "local",
          worktreePath: null,
        },
        projects: [
          {
            id: projectId,
            workspaceRoot: "/repo/project-1",
          },
        ],
      }),
    ).toBe("/repo/project-1");
  });

  it("uses a materialized worktree path when worktree mode is active", () => {
    const projectId = ProjectId.makeUnsafe("project-2");

    expect(
      resolveThreadWorkspaceCwd({
        thread: {
          projectId,
          envMode: "worktree",
          worktreePath: "/repo/.worktrees/thread-2",
        },
        projects: [
          {
            id: projectId,
            workspaceRoot: "/repo/project-2",
          },
        ],
      }),
    ).toBe("/repo/.worktrees/thread-2");
  });

  it("returns undefined when the thread project is missing from the snapshot", () => {
    expect(
      resolveThreadWorkspaceCwd({
        thread: {
          projectId: ProjectId.makeUnsafe("missing-project"),
          envMode: "local",
          worktreePath: null,
        },
        projects: [
          {
            id: ProjectId.makeUnsafe("project-3"),
            workspaceRoot: "/repo/project-3",
          },
        ],
      }),
    ).toBeUndefined();
  });

  it("returns undefined for pending worktree threads until the path is materialized", () => {
    const projectId = ProjectId.makeUnsafe("project-4");

    expect(
      resolveThreadWorkspaceCwd({
        thread: {
          projectId,
          envMode: "worktree",
          worktreePath: null,
        },
        projects: [
          {
            id: projectId,
            workspaceRoot: "/repo/project-4",
          },
        ],
      }),
    ).toBeUndefined();
  });
});
