import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { RotatingFileSink } from "./logging";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "h3-rotating-log-"));
  tempDirs.push(tempDir);
  return tempDir;
}

function rotateOnce(sink: RotatingFileSink): void {
  (sink as unknown as { rotate(): void }).rotate();
}

afterEach(() => {
  vi.restoreAllMocks();

  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("RotatingFileSink", () => {
  it("rejects maxBytes smaller than one", () => {
    const logPath = path.join(makeTempDir(), "app.log");

    expect(
      () =>
        new RotatingFileSink({
          filePath: logPath,
          maxBytes: 0,
          maxFiles: 1,
        }),
    ).toThrowError("maxBytes must be >= 1 (received 0)");
  });

  it("rejects maxFiles smaller than one", () => {
    const logPath = path.join(makeTempDir(), "app.log");

    expect(
      () =>
        new RotatingFileSink({
          filePath: logPath,
          maxBytes: 1,
          maxFiles: 0,
        }),
    ).toThrowError("maxFiles must be >= 1 (received 0)");
  });

  it("prunes only overflow backups during startup", () => {
    const tempDir = makeTempDir();
    const logPath = path.join(tempDir, "app.log");

    fs.writeFileSync(path.join(tempDir, "app.log.1"), "first", "utf8");
    fs.writeFileSync(path.join(tempDir, "app.log.2"), "second", "utf8");
    fs.writeFileSync(path.join(tempDir, "app.log.3"), "stale-third", "utf8");
    fs.writeFileSync(path.join(tempDir, "app.log.bad"), "keep-me", "utf8");

    const sink = new RotatingFileSink({
      filePath: logPath,
      maxBytes: 64,
      maxFiles: 2,
    });

    expect(sink).toBeInstanceOf(RotatingFileSink);
    expect(fs.existsSync(path.join(tempDir, "app.log.1"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "app.log.2"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "app.log.3"))).toBe(false);
    expect(fs.readFileSync(path.join(tempDir, "app.log.bad"), "utf8")).toBe("keep-me");
  });

  it("rotates backups in sequence before appending an overflowing write", () => {
    const tempDir = makeTempDir();
    const logPath = path.join(tempDir, "app.log");

    fs.writeFileSync(logPath, "curr", "utf8");
    fs.writeFileSync(path.join(tempDir, "app.log.1"), "prev-1", "utf8");
    fs.writeFileSync(path.join(tempDir, "app.log.2"), "prev-2", "utf8");
    fs.writeFileSync(path.join(tempDir, "app.log.3"), "prev-3", "utf8");

    const sink = new RotatingFileSink({
      filePath: logPath,
      maxBytes: 6,
      maxFiles: 3,
    });

    sink.write("new");

    expect(fs.readFileSync(logPath, "utf8")).toBe("new");
    expect(fs.readFileSync(path.join(tempDir, "app.log.1"), "utf8")).toBe("curr");
    expect(fs.readFileSync(path.join(tempDir, "app.log.2"), "utf8")).toBe("prev-1");
    expect(fs.readFileSync(path.join(tempDir, "app.log.3"), "utf8")).toBe("prev-2");
  });

  it("treats zero-length string and buffer writes as no-ops", () => {
    const tempDir = makeTempDir();
    const logPath = path.join(tempDir, "app.log");
    const sink = new RotatingFileSink({
      filePath: logPath,
      maxBytes: 4,
      maxFiles: 2,
    });

    sink.write("");
    sink.write(Buffer.alloc(0));

    expect(fs.existsSync(logPath)).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "app.log.1"))).toBe(false);
  });

  it("swallows append failures when throwOnError is false and recovers on the next write", () => {
    const tempDir = makeTempDir();
    const logPath = path.join(tempDir, "app.log");

    fs.writeFileSync(logPath, "seed", "utf8");

    const sink = new RotatingFileSink({
      filePath: logPath,
      maxBytes: 16,
      maxFiles: 2,
      throwOnError: false,
    });

    vi.spyOn(fs, "appendFileSync").mockImplementationOnce(() => {
      throw new Error("disk full");
    });

    expect(() => sink.write("fail")).not.toThrow();
    expect(fs.readFileSync(logPath, "utf8")).toBe("seed");

    sink.write("ok");

    expect(fs.readFileSync(logPath, "utf8")).toBe("seedok");
  });

  it("throws a stable error when append fails and throwOnError is true", () => {
    const tempDir = makeTempDir();
    const logPath = path.join(tempDir, "app.log");

    fs.writeFileSync(logPath, "seed", "utf8");

    const sink = new RotatingFileSink({
      filePath: logPath,
      maxBytes: 16,
      maxFiles: 2,
      throwOnError: true,
    });

    vi.spyOn(fs, "appendFileSync").mockImplementationOnce(() => {
      throw new Error("disk full");
    });

    expect(() => sink.write("fail")).toThrowError(`Failed to write log chunk to ${logPath}`);
    expect(fs.readFileSync(logPath, "utf8")).toBe("seed");
  });

  it("swallows rotate failures when throwOnError is false", () => {
    const tempDir = makeTempDir();
    const logPath = path.join(tempDir, "app.log");

    fs.writeFileSync(logPath, "seed", "utf8");

    const sink = new RotatingFileSink({
      filePath: logPath,
      maxBytes: 4,
      maxFiles: 2,
      throwOnError: false,
    });

    vi.spyOn(fs, "renameSync").mockImplementationOnce(() => {
      throw new Error("rename failed");
    });

    expect(() => rotateOnce(sink)).not.toThrow();
    expect(fs.readFileSync(logPath, "utf8")).toBe("seed");
  });

  it("throws a stable error when rotate fails and throwOnError is true", () => {
    const tempDir = makeTempDir();
    const logPath = path.join(tempDir, "app.log");

    fs.writeFileSync(logPath, "seed", "utf8");

    const sink = new RotatingFileSink({
      filePath: logPath,
      maxBytes: 4,
      maxFiles: 2,
      throwOnError: true,
    });

    vi.spyOn(fs, "renameSync").mockImplementationOnce(() => {
      throw new Error("rename failed");
    });

    expect(() => rotateOnce(sink)).toThrowError(`Failed to rotate log file ${logPath}`);
    expect(fs.readFileSync(logPath, "utf8")).toBe("seed");
  });
});
