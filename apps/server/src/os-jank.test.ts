// FILE: os-jank.test.ts
// Purpose: Verifies PATH hydration keeps inherited entries and macOS fallbacks.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { fixPath, resolveDefaultBaseDir } from "./os-jank";

describe("fixPath", () => {
  it("hydrates PATH on linux using the resolved login shell", () => {
    const env: NodeJS.ProcessEnv = {
      SHELL: "/bin/zsh",
      PATH: "/Users/test/.local/bin:/usr/bin",
    };
    const readPath = vi.fn(() => "/opt/homebrew/bin:/usr/bin");

    fixPath({
      env,
      platform: "linux",
      readPath,
    });

    expect(readPath).toHaveBeenCalledWith("/bin/zsh");
    expect(env.PATH).toBe("/opt/homebrew/bin:/usr/bin:/Users/test/.local/bin");
  });

  it("falls back to launchctl PATH on macOS when shell probing fails", () => {
    const env: NodeJS.ProcessEnv = {
      SHELL: "/opt/homebrew/bin/nu",
      PATH: "/usr/bin",
    };
    const readPath = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("unknown flag");
      })
      .mockImplementationOnce(() => undefined);
    const readLaunchctlPath = vi.fn(() => "/opt/homebrew/bin:/usr/bin");
    const logWarning = vi.fn();

    fixPath({
      env,
      platform: "darwin",
      readPath,
      readLaunchctlPath,
      userShell: "/bin/zsh",
      logWarning,
    });

    expect(readPath).toHaveBeenNthCalledWith(1, "/opt/homebrew/bin/nu");
    expect(readPath).toHaveBeenNthCalledWith(2, "/bin/zsh");
    expect(readLaunchctlPath).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith(
      "Failed to read PATH from login shell /opt/homebrew/bin/nu.",
      expect.any(Error),
    );
    expect(env.PATH).toBe("/opt/homebrew/bin:/usr/bin");
  });

  it("does nothing on unsupported platforms", () => {
    const env: NodeJS.ProcessEnv = {
      SHELL: "C:/Program Files/Git/bin/bash.exe",
      PATH: "C:/Windows/System32",
    };
    const readPath = vi.fn(() => "C:/Git/bin");

    fixPath({
      env,
      platform: "win32",
      readPath,
    });

    expect(readPath).not.toHaveBeenCalled();
    expect(env.PATH).toBe("C:/Windows/System32");
  });
});

describe("resolveBaseDir", () => {
  it("renames the legacy .dpcode home to .h3code when no explicit base dir is provided", () => {
    const tempHome = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "h3code-base-dir-"));
    const legacyDir = path.join(tempHome, ".dpcode");
    const canonicalDir = path.join(tempHome, ".h3code");
    fs.mkdirSync(legacyDir, { recursive: true });

    try {
      const result = resolveDefaultBaseDir({ homeDir: tempHome });
      expect(result).toBe(canonicalDir);
      expect(fs.existsSync(canonicalDir)).toBe(true);
      expect(fs.existsSync(legacyDir)).toBe(false);
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it("falls back to the legacy path when the rename cannot complete", () => {
    const tempHome = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "h3code-base-dir-"));
    const legacyDir = path.join(tempHome, ".dpcode");
    const canonicalDir = path.join(tempHome, ".h3code");
    fs.mkdirSync(legacyDir, { recursive: true });

    try {
      const result = resolveDefaultBaseDir({
        homeDir: tempHome,
        renameSync: () => {
          throw new Error("rename blocked");
        },
      });
      expect(result).toBe(legacyDir);
      expect(fs.existsSync(legacyDir)).toBe(true);
      expect(fs.existsSync(canonicalDir)).toBe(false);
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });
});
