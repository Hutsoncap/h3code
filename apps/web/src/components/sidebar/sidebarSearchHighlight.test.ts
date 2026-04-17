import { assert, describe, it } from "vitest";

import { buildSidebarSearchHighlightSegments } from "./sidebarSearchHighlightSegments";

describe("sidebarSearchHighlight", () => {
  it("returns a single plain segment when the query is empty", () => {
    assert.deepEqual(buildSidebarSearchHighlightSegments("Composer refactor", ""), [
      {
        highlighted: false,
        key: "plain:0",
        text: "Composer refactor",
      },
    ]);
  });

  it("uses longest unique tokens first when queries overlap", () => {
    assert.deepEqual(buildSidebarSearchHighlightSegments("aaaa", "a aa aa"), [
      {
        highlighted: true,
        key: "hit:0",
        text: "aa",
      },
      {
        highlighted: true,
        key: "hit:2",
        text: "aa",
      },
    ]);
  });

  it("keeps repeated matches deterministic with offset-based keys", () => {
    assert.deepEqual(buildSidebarSearchHighlightSegments("compose compose compose", "compose"), [
      {
        highlighted: true,
        key: "hit:0",
        text: "compose",
      },
      {
        highlighted: false,
        key: "plain:7",
        text: " ",
      },
      {
        highlighted: true,
        key: "hit:8",
        text: "compose",
      },
      {
        highlighted: false,
        key: "plain:15",
        text: " ",
      },
      {
        highlighted: true,
        key: "hit:16",
        text: "compose",
      },
    ]);
  });

  it("keeps non-matching text between repeated hits", () => {
    assert.deepEqual(buildSidebarSearchHighlightSegments("foo test bar test", "test"), [
      {
        highlighted: false,
        key: "plain:0",
        text: "foo ",
      },
      {
        highlighted: true,
        key: "hit:4",
        text: "test",
      },
      {
        highlighted: false,
        key: "plain:8",
        text: " bar ",
      },
      {
        highlighted: true,
        key: "hit:13",
        text: "test",
      },
    ]);
  });
});
