import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  ProjectSearchEntriesInput,
  ProjectSearchEntriesResult,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
} from "./project";

function decodeSync<S extends Schema.Top>(schema: S, input: unknown): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never)(input) as Schema.Schema.Type<S>;
}

describe("ProjectSearchEntriesInput", () => {
  it("parses trimmed search requests at the max supported limit", () => {
    const parsed = decodeSync(ProjectSearchEntriesInput, {
      cwd: " /repo ",
      query: " src/wsServer ",
      limit: 200,
    });

    expect(parsed.cwd).toBe("/repo");
    expect(parsed.query).toBe("src/wsServer");
    expect(parsed.limit).toBe(200);
  });

  it("rejects limits above the supported maximum", () => {
    expect(() =>
      decodeSync(ProjectSearchEntriesInput, {
        cwd: "/repo",
        query: "server",
        limit: 201,
      }),
    ).toThrow();
  });
});

describe("ProjectSearchEntriesResult", () => {
  it("parses file and directory entries with optional parent paths", () => {
    const parsed = decodeSync(ProjectSearchEntriesResult, {
      entries: [
        {
          path: " apps/server/src ",
          kind: "directory",
        },
        {
          path: " apps/server/src/wsServer.ts ",
          kind: "file",
          parentPath: " apps/server/src ",
        },
      ],
      truncated: true,
    });

    expect(parsed.truncated).toBe(true);
    expect(parsed.entries).toEqual([
      {
        path: "apps/server/src",
        kind: "directory",
      },
      {
        path: "apps/server/src/wsServer.ts",
        kind: "file",
        parentPath: "apps/server/src",
      },
    ]);
  });

  it("rejects unsupported entry kinds", () => {
    expect(() =>
      decodeSync(ProjectSearchEntriesResult, {
        entries: [
          {
            path: "apps/server/src/wsServer.ts",
            kind: "symlink",
          },
        ],
        truncated: false,
      }),
    ).toThrow();
  });
});

describe("ProjectWriteFileInput", () => {
  it("parses trimmed paths and preserves file contents", () => {
    const parsed = decodeSync(ProjectWriteFileInput, {
      cwd: " /repo ",
      relativePath: " notes/todo.md ",
      contents: "# TODO\n- keep this formatting\n",
    });

    expect(parsed.cwd).toBe("/repo");
    expect(parsed.relativePath).toBe("notes/todo.md");
    expect(parsed.contents).toBe("# TODO\n- keep this formatting\n");
  });

  it("rejects relative paths above the max supported length", () => {
    expect(() =>
      decodeSync(ProjectWriteFileInput, {
        cwd: "/repo",
        relativePath: `dir/${"a".repeat(509)}`,
        contents: "hello",
      }),
    ).toThrow();
  });
});

describe("ProjectWriteFileResult", () => {
  it("parses trimmed write results", () => {
    const parsed = decodeSync(ProjectWriteFileResult, {
      relativePath: " notes/todo.md ",
    });

    expect(parsed.relativePath).toBe("notes/todo.md");
  });

  it("rejects blank relative paths", () => {
    expect(() =>
      decodeSync(ProjectWriteFileResult, {
        relativePath: "   ",
      }),
    ).toThrow();
  });
});
