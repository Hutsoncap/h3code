import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  normalizeAttachmentRelativePath,
  resolveAttachmentRelativePath,
} from "./attachmentPaths.ts";

describe("attachmentPaths", () => {
  it("normalizes safe attachment-relative paths", () => {
    expect(normalizeAttachmentRelativePath("/thread-a/message-a/0.png")).toBe(
      "thread-a/message-a/0.png",
    );
    expect(normalizeAttachmentRelativePath("thread-a/./message-a/../message-b/0.png")).toBe(
      "thread-a/message-b/0.png",
    );
  });

  it("rejects traversal and malformed attachment URLs when normalizing", () => {
    expect(normalizeAttachmentRelativePath("../escape.png")).toBeNull();
    expect(normalizeAttachmentRelativePath("https://example.com/thread-a/0.png")).toBeNull();
    expect(normalizeAttachmentRelativePath("file:///tmp/thread-a/0.png")).toBeNull();
  });

  it("resolves safe attachment-relative paths inside the attachments root", () => {
    const attachmentsDir = fs.mkdtempSync(path.join(os.tmpdir(), "t3code-attachment-paths-"));
    try {
      const resolved = resolveAttachmentRelativePath({
        attachmentsDir,
        relativePath: "thread-a/message-a/0.png",
      });

      expect(resolved).toBe(path.join(attachmentsDir, "thread-a", "message-a", "0.png"));
    } finally {
      fs.rmSync(attachmentsDir, { recursive: true, force: true });
    }
  });

  it("rejects traversal and malformed attachment URLs when resolving", () => {
    const attachmentsDir = fs.mkdtempSync(path.join(os.tmpdir(), "t3code-attachment-paths-"));
    try {
      expect(
        resolveAttachmentRelativePath({
          attachmentsDir,
          relativePath: "../escape.png",
        }),
      ).toBeNull();
      expect(
        resolveAttachmentRelativePath({
          attachmentsDir,
          relativePath: "https://example.com/thread-a/0.png",
        }),
      ).toBeNull();
    } finally {
      fs.rmSync(attachmentsDir, { recursive: true, force: true });
    }
  });
});
