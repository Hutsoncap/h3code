import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { isGitRepository } from "./isRepo.ts";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("isGitRepository", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns true when the cwd has a .git entry", () => {
    const repoDir = makeTempDir("t3code-is-repo-");
    fs.mkdirSync(path.join(repoDir, ".git"));

    expect(isGitRepository(repoDir)).toBe(true);
  });

  it("returns false when the cwd does not have a .git entry", () => {
    const repoDir = makeTempDir("t3code-not-repo-");

    expect(isGitRepository(repoDir)).toBe(false);
  });
});
