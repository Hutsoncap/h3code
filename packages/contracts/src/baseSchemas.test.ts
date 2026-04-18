import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  ApprovalRequestId,
  NonNegativeInt,
  PositiveInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
  TrimmedString,
} from "./baseSchemas";

function decodeSync<S extends Schema.Top>(schema: S, input: unknown): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never)(input) as Schema.Schema.Type<S>;
}

describe("TrimmedString", () => {
  it("trims leading and trailing whitespace", () => {
    expect(decodeSync(TrimmedString, "  hello world  ")).toBe("hello world");
  });

  it("normalizes whitespace-only strings to empty strings", () => {
    expect(decodeSync(TrimmedString, " \n\t ")).toBe("");
  });
});

describe("TrimmedNonEmptyString", () => {
  it("trims and decodes non-empty strings", () => {
    expect(decodeSync(TrimmedNonEmptyString, "  project title  ")).toBe("project title");
  });

  it("rejects strings that become empty after trimming", () => {
    expect(() => decodeSync(TrimmedNonEmptyString, "   ")).toThrow();
    expect(() => decodeSync(TrimmedNonEmptyString, "\n\t")).toThrow();
  });
});

describe("NonNegativeInt", () => {
  it("accepts zero and positive integers", () => {
    expect(decodeSync(NonNegativeInt, 0)).toBe(0);
    expect(decodeSync(NonNegativeInt, 42)).toBe(42);
  });

  it("rejects negative numbers and non-integers", () => {
    expect(() => decodeSync(NonNegativeInt, -1)).toThrow();
    expect(() => decodeSync(NonNegativeInt, 1.5)).toThrow();
  });
});

describe("PositiveInt", () => {
  it("accepts integers greater than zero", () => {
    expect(decodeSync(PositiveInt, 1)).toBe(1);
    expect(decodeSync(PositiveInt, 7)).toBe(7);
  });

  it("rejects zero and negative integers", () => {
    expect(() => decodeSync(PositiveInt, 0)).toThrow();
    expect(() => decodeSync(PositiveInt, -2)).toThrow();
  });
});

describe("ThreadId", () => {
  it("trims branded ids at decode time", () => {
    expect(decodeSync(ThreadId, " thread-1 ")).toBe("thread-1");
  });

  it("rejects blank ids", () => {
    expect(() => decodeSync(ThreadId, "   ")).toThrow();
  });
});

describe("ProjectId", () => {
  it("trims branded ids at decode time", () => {
    expect(decodeSync(ProjectId, " project-1 ")).toBe("project-1");
  });

  it("rejects blank ids", () => {
    expect(() => decodeSync(ProjectId, "\n\t")).toThrow();
  });
});

describe("ApprovalRequestId", () => {
  it("trims branded ids at decode time", () => {
    expect(decodeSync(ApprovalRequestId, " approval-1 ")).toBe("approval-1");
  });

  it("rejects blank ids", () => {
    expect(() => decodeSync(ApprovalRequestId, " ")).toThrow();
  });
});
