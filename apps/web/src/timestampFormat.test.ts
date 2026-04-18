import { describe, expect, it } from "vitest";

import {
  formatShortTimestamp,
  formatTimestamp,
  getTimestampFormatOptions,
} from "./timestampFormat";

describe("getTimestampFormatOptions", () => {
  it("omits hour12 when locale formatting is requested", () => {
    expect(getTimestampFormatOptions("locale", true)).toEqual({
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  });

  it("builds a 12-hour formatter with seconds when requested", () => {
    expect(getTimestampFormatOptions("12-hour", true)).toEqual({
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  });

  it("builds a 24-hour formatter without seconds when requested", () => {
    expect(getTimestampFormatOptions("24-hour", false)).toEqual({
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  });

  it("returns an empty string for blank or malformed timestamps", () => {
    expect(formatTimestamp("", "locale")).toBe("");
    expect(formatShortTimestamp("not-a-date", "24-hour")).toBe("");
  });

  it("trims valid timestamps before formatting", () => {
    expect(formatTimestamp(" 2026-03-17T19:12:29.000Z ", "locale")).toBe(
      formatTimestamp("2026-03-17T19:12:29.000Z", "locale"),
    );
  });
});
