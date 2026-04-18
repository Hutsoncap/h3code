import { describe, expect, it } from "vitest";

import {
  compareCodexCliVersions,
  formatCodexCliUpgradeMessage,
  isCodexCliVersionSupported,
  parseCodexCliVersion,
} from "./codexCliVersion";

describe("codexCliVersion", () => {
  describe("parseCodexCliVersion", () => {
    it("normalizes shortened 0.37-style versions", () => {
      expect(parseCodexCliVersion("codex 0.37")).toBe("0.37.0");
      expect(parseCodexCliVersion("codex v0.37.1")).toBe("0.37.1");
    });

    it("preserves prerelease identifiers without collapsing hyphens", () => {
      expect(parseCodexCliVersion("codex 0.37.0-alpha-beta.1")).toBe("0.37.0-alpha-beta.1");
      expect(parseCodexCliVersion("codex 0.37.0-rc.1")).toBe("0.37.0-rc.1");
    });

    it("rejects malformed prerelease tokens", () => {
      expect(parseCodexCliVersion("codex 0.37.0-alpha..1")).toBeNull();
    });
  });

  describe("compareCodexCliVersions", () => {
    it("orders prereleases below the final release", () => {
      expect(compareCodexCliVersions("0.37.0-rc.1", "0.37.0")).toBeLessThan(0);
      expect(compareCodexCliVersions("0.37.0", "0.37.0-rc.1")).toBeGreaterThan(0);
    });

    it("compares prerelease identifiers deterministically", () => {
      expect(compareCodexCliVersions("0.37.0-alpha.9", "0.37.0-alpha.10")).toBeLessThan(0);
      expect(compareCodexCliVersions("0.37.0-alpha.beta", "0.37.0-alpha.1")).toBeGreaterThan(0);
      expect(compareCodexCliVersions("0.37.0-alpha-beta.1", "0.37.0-alpha-beta.2")).toBeLessThan(0);
    });
  });

  describe("isCodexCliVersionSupported", () => {
    it("treats prerelease builds as unsupported for the minimum release gate", () => {
      expect(isCodexCliVersionSupported("0.37.0-rc.1")).toBe(false);
      expect(isCodexCliVersionSupported("0.37.0")).toBe(true);
    });
  });

  describe("formatCodexCliUpgradeMessage", () => {
    it("uses a stable human-readable fallback when the version is unknown", () => {
      expect(formatCodexCliUpgradeMessage(null)).toBe(
        "Codex CLI the installed version is too old for H3 Code. Upgrade to v0.37.0 or newer and restart H3 Code.",
      );
    });

    it("prefixes parsed versions once in the upgrade message", () => {
      expect(formatCodexCliUpgradeMessage("0.37.0-rc.1")).toBe(
        "Codex CLI v0.37.0-rc.1 is too old for H3 Code. Upgrade to v0.37.0 or newer and restart H3 Code.",
      );
    });
  });
});
