import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createAttachmentId,
  parseAttachmentIdFromRelativePath,
  parseThreadSegmentFromAttachmentId,
  resolveAttachmentPathById,
} from "./attachmentStore.ts";

describe("attachmentStore", () => {
  it("returns null when a thread id cannot produce a safe attachment id", () => {
    expect(createAttachmentId(" /// ... --- ")).toBeNull();
  });

  it("sanitizes thread ids when creating attachment ids", () => {
    const attachmentId = createAttachmentId("thread.folder/unsafe space");
    expect(attachmentId).toBeTruthy();
    if (!attachmentId) {
      return;
    }

    const threadSegment = parseThreadSegmentFromAttachmentId(attachmentId);
    expect(threadSegment).toBeTruthy();
    expect(threadSegment).toMatch(/^[a-z0-9_-]+$/i);
    expect(threadSegment).not.toContain(".");
    expect(threadSegment).not.toContain("%");
    expect(threadSegment).not.toContain("/");
  });

  it("parses exact thread segments from attachment ids without prefix collisions", () => {
    const fooId = "foo-00000000-0000-4000-8000-000000000001";
    const fooBarId = "foo-bar-00000000-0000-4000-8000-000000000002";

    expect(parseThreadSegmentFromAttachmentId(fooId)).toBe("foo");
    expect(parseThreadSegmentFromAttachmentId(fooBarId)).toBe("foo-bar");
  });

  it("normalizes created thread segments to lowercase", () => {
    const attachmentId = createAttachmentId("Thread.Foo");
    expect(attachmentId).toBeTruthy();
    if (!attachmentId) {
      return;
    }
    expect(parseThreadSegmentFromAttachmentId(attachmentId)).toBe("thread-foo");
  });

  it("drops trailing separators after truncating long sanitized thread segments", () => {
    const attachmentId = createAttachmentId(`${"a".repeat(79)}--unsafe`);
    expect(attachmentId).toBeTruthy();
    if (!attachmentId) {
      return;
    }
    expect(parseThreadSegmentFromAttachmentId(attachmentId)).toBe("a".repeat(79));
  });

  it("rejects non-canonical casing when parsing attachment ids", () => {
    expect(
      parseThreadSegmentFromAttachmentId("Foo-00000000-0000-4000-8000-000000000001"),
    ).toBeNull();
    expect(
      parseThreadSegmentFromAttachmentId("foo-00000000-0000-4000-8000-00000000000A"),
    ).toBeNull();
  });

  it("rejects path-like wrappers when parsing attachment ids", () => {
    const attachmentId = "foo-00000000-0000-4000-8000-000000000001";

    expect(parseThreadSegmentFromAttachmentId(`./${attachmentId}`)).toBeNull();
    expect(parseThreadSegmentFromAttachmentId(`/${attachmentId}`)).toBeNull();
    expect(parseThreadSegmentFromAttachmentId(`${attachmentId}/../${attachmentId}`)).toBeNull();
  });

  it("parses only exact supported attachment relative paths", () => {
    const attachmentId = "foo-00000000-0000-4000-8000-000000000001";

    expect(parseAttachmentIdFromRelativePath(`${attachmentId}.png`)).toBe(attachmentId);
    expect(parseAttachmentIdFromRelativePath(`${attachmentId}.PNG`)).toBe(attachmentId);
    expect(parseAttachmentIdFromRelativePath(`./${attachmentId}.png`)).toBeNull();
    expect(parseAttachmentIdFromRelativePath(`${attachmentId}.txt`)).toBeNull();
    expect(parseAttachmentIdFromRelativePath(`${attachmentId}.tar.gz`)).toBeNull();
  });

  it("resolves attachment path by id using the extension that exists on disk", () => {
    const attachmentsDir = fs.mkdtempSync(path.join(os.tmpdir(), "t3code-attachment-store-"));
    try {
      const attachmentId = "thread-1-00000000-0000-4000-8000-000000000001";
      const pngPath = path.join(attachmentsDir, `${attachmentId}.png`);
      fs.writeFileSync(pngPath, Buffer.from("hello"));

      const resolved = resolveAttachmentPathById({
        attachmentsDir,
        attachmentId,
      });
      expect(resolved).toBe(pngPath);
    } finally {
      fs.rmSync(attachmentsDir, { recursive: true, force: true });
    }
  });

  it("resolves attachment paths only for exact attachment ids", () => {
    const attachmentsDir = fs.mkdtempSync(path.join(os.tmpdir(), "t3code-attachment-store-"));
    try {
      const attachmentId = "thread-1-00000000-0000-4000-8000-000000000001";
      const pngPath = path.join(attachmentsDir, `${attachmentId}.png`);
      fs.writeFileSync(pngPath, Buffer.from("hello"));

      expect(resolveAttachmentPathById({ attachmentsDir, attachmentId })).toBe(pngPath);
      expect(
        resolveAttachmentPathById({
          attachmentsDir,
          attachmentId: "Thread-1-00000000-0000-4000-8000-000000000001",
        }),
      ).toBeNull();
      expect(
        resolveAttachmentPathById({
          attachmentsDir,
          attachmentId: "thread-1-00000000-0000-4000-8000-00000000000A",
        }),
      ).toBeNull();
      expect(
        resolveAttachmentPathById({ attachmentsDir, attachmentId: `./${attachmentId}` }),
      ).toBeNull();
      expect(
        resolveAttachmentPathById({ attachmentsDir, attachmentId: `/${attachmentId}` }),
      ).toBeNull();
      expect(
        resolveAttachmentPathById({
          attachmentsDir,
          attachmentId: `${attachmentId}/../${attachmentId}`,
        }),
      ).toBeNull();
      expect(
        resolveAttachmentPathById({
          attachmentsDir,
          attachmentId: `${attachmentId}.png`,
        }),
      ).toBeNull();
    } finally {
      fs.rmSync(attachmentsDir, { recursive: true, force: true });
    }
  });

  it("returns null when no attachment file exists for the id", () => {
    const attachmentsDir = fs.mkdtempSync(path.join(os.tmpdir(), "t3code-attachment-store-"));
    try {
      const resolved = resolveAttachmentPathById({
        attachmentsDir,
        attachmentId: "thread-1-00000000-0000-4000-8000-000000000001",
      });
      expect(resolved).toBeNull();
    } finally {
      fs.rmSync(attachmentsDir, { recursive: true, force: true });
    }
  });
});
