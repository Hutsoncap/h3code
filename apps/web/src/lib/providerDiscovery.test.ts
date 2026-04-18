import { describe, expect, it } from "vitest";

import {
  buildCommandSearchBlob,
  buildPluginSearchBlob,
  buildSkillSearchBlob,
  formatSkillScope,
} from "./providerDiscovery";

describe("providerDiscovery", () => {
  it("ignores quote-wrapped blank metadata when building skill search blobs", () => {
    expect(
      buildSkillSearchBlob({
        name: "terminal-tools",
        description: ' "   " ',
        interface: {
          displayName: "Terminal Tools",
          shortDescription: " '   ' ",
        },
      }),
    ).toBe("terminal tools terminal tools");
  });

  it("ignores quote-wrapped blank metadata when building plugin search blobs", () => {
    expect(
      buildPluginSearchBlob({
        name: "git-helper",
        interface: {
          displayName: "Git Helper",
          shortDescription: ' "   " ',
          category: "source control",
          developerName: " '   ' ",
        },
      }),
    ).toBe("git helper git helper source control");
  });

  it("ignores quote-wrapped blank descriptions when building command search blobs", () => {
    expect(
      buildCommandSearchBlob({
        name: "server.restart",
        description: ' "   " ',
      }),
    ).toBe("server.restart");
  });

  it("treats quote-wrapped blank scopes as personal", () => {
    expect(formatSkillScope(" '   ' ")).toBe("Personal");
  });
});
