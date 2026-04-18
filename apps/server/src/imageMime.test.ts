import { describe, expect, it } from "vitest";

import { inferImageExtension, parseBase64DataUrl } from "./imageMime.ts";

describe("imageMime", () => {
  it("parses base64 data URL with mime type", () => {
    expect(parseBase64DataUrl("data:image/png;base64,SGVsbG8=")).toEqual({
      mimeType: "image/png",
      base64: "SGVsbG8=",
    });
  });

  it("parses base64 data URL with mime parameters", () => {
    expect(parseBase64DataUrl("data:image/png;charset=utf-8;base64,SGVsbG8=")).toEqual({
      mimeType: "image/png",
      base64: "SGVsbG8=",
    });
  });

  it("rejects non-base64 data URL", () => {
    expect(parseBase64DataUrl("data:image/png;charset=utf-8,hello")).toBeNull();
  });

  it("rejects missing mime type", () => {
    expect(parseBase64DataUrl("data:;base64,SGVsbG8=")).toBeNull();
  });

  it("parses base64 data URL with spaces in payload", () => {
    expect(parseBase64DataUrl("data:image/png;base64,SGVs bG8=\n")).toEqual({
      mimeType: "image/png",
      base64: "SGVsbG8=",
    });
  });

  it("does not read inherited keys from mime extension map", () => {
    expect(inferImageExtension({ mimeType: "constructor" })).toBe(".bin");
  });

  it("normalizes MIME casing and surrounding whitespace before direct lookups", () => {
    expect(inferImageExtension({ mimeType: " IMAGE/JPEG " })).toBe(".jpg");
    expect(inferImageExtension({ mimeType: " image/svg+xml " })).toBe(".svg");
  });

  it("falls back to a safe filename extension when MIME lookup is unknown", () => {
    expect(
      inferImageExtension({
        mimeType: "application/octet-stream",
        fileName: " photo.JPEG ",
      }),
    ).toBe(".jpeg");
    expect(
      inferImageExtension({
        mimeType: "application/octet-stream",
        fileName: "diagram.SVG",
      }),
    ).toBe(".svg");
  });

  it("returns .bin when neither MIME nor filename provide a safe image extension", () => {
    expect(
      inferImageExtension({
        mimeType: " application/octet-stream ",
        fileName: "archive.tar.gz",
      }),
    ).toBe(".bin");
    expect(
      inferImageExtension({
        mimeType: "unknown/unknown",
        fileName: "payload.exe",
      }),
    ).toBe(".bin");
  });
});
