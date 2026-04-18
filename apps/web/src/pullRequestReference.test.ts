import { describe, expect, it } from "vitest";

import { parsePullRequestReference } from "./pullRequestReference";

describe("parsePullRequestReference", () => {
  it("normalizes GitHub pull request URLs to canonical numbers", () => {
    expect(
      parsePullRequestReference(" https://github.com/pingdotgg/t3code/pull/0042?tab=files "),
    ).toBe("42");
  });

  it("accepts raw numbers", () => {
    expect(parsePullRequestReference("42")).toBe("42");
  });

  it("normalizes #number references", () => {
    expect(parsePullRequestReference("#0042")).toBe("42");
  });

  it("accepts references wrapped by autolink or prose punctuation", () => {
    expect(parsePullRequestReference("<https://github.com/pingdotgg/t3code/pull/0042>")).toBe("42");
    expect(parsePullRequestReference("<https://github.com/pingdotgg/t3code/pull/0042>,")).toBe(
      "42",
    );
    expect(parsePullRequestReference("#0042,")).toBe("42");
    expect(parsePullRequestReference("https://github.com/pingdotgg/t3code/pull/0042).")).toBe("42");
  });

  it("rejects zero-valued references", () => {
    expect(parsePullRequestReference("0")).toBeNull();
    expect(parsePullRequestReference("#000")).toBeNull();
    expect(parsePullRequestReference("https://github.com/pingdotgg/t3code/pull/000")).toBeNull();
  });

  it("rejects non-pull-request input", () => {
    expect(parsePullRequestReference("feature/my-branch")).toBeNull();
    expect(parsePullRequestReference("https://github.com/pingdotgg/t3code/issues/42")).toBeNull();
  });
});
