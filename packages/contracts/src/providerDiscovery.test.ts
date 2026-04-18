import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  ProviderComposerCapabilities,
  ProviderGetComposerCapabilitiesInput,
  ProviderListModelsInput,
  ProviderListModelsResult,
  ProviderListPluginsInput,
  ProviderListPluginsResult,
  ProviderListSkillsInput,
  ProviderListSkillsResult,
} from "./providerDiscovery";

const decodeComposerCapabilities = Schema.decodeUnknownSync(ProviderComposerCapabilities);
const decodeGetComposerCapabilitiesInput = Schema.decodeUnknownSync(
  ProviderGetComposerCapabilitiesInput,
);
const decodeListSkillsInput = Schema.decodeUnknownSync(ProviderListSkillsInput);
const decodeListSkillsResult = Schema.decodeUnknownSync(ProviderListSkillsResult);
const decodeListPluginsInput = Schema.decodeUnknownSync(ProviderListPluginsInput);
const decodeListPluginsResult = Schema.decodeUnknownSync(ProviderListPluginsResult);
const decodeListModelsInput = Schema.decodeUnknownSync(ProviderListModelsInput);
const decodeListModelsResult = Schema.decodeUnknownSync(ProviderListModelsResult);

describe("providerDiscovery", () => {
  it("accepts composer capability payloads", () => {
    const parsed = decodeComposerCapabilities({
      provider: "codex",
      supportsSkillMentions: true,
      supportsSkillDiscovery: true,
      supportsNativeSlashCommandDiscovery: false,
      supportsPluginMentions: true,
      supportsPluginDiscovery: false,
      supportsRuntimeModelList: true,
    });

    expect(parsed.provider).toBe("codex");
    expect(parsed.supportsSkillMentions).toBe(true);
    expect(parsed.supportsRuntimeModelList).toBe(true);
  });

  it("rejects invalid composer providers", () => {
    expect(() =>
      decodeComposerCapabilities({
        provider: "unknown",
        supportsSkillMentions: true,
        supportsSkillDiscovery: true,
        supportsNativeSlashCommandDiscovery: false,
        supportsPluginMentions: true,
        supportsPluginDiscovery: false,
        supportsRuntimeModelList: true,
      }),
    ).toThrow();
  });

  it("accepts trimmed provider discovery inputs for skills, plugins, and models", () => {
    const skillsInput = decodeListSkillsInput({
      provider: "claudeAgent",
      cwd: " /tmp/workspace ",
      threadId: " thread-1 ",
      forceReload: true,
    });
    const pluginsInput = decodeListPluginsInput({
      provider: "codex",
      cwd: " /tmp/workspace ",
      threadId: " thread-2 ",
      forceRemoteSync: false,
      forceReload: true,
    });
    const modelsInput = decodeListModelsInput({
      provider: "codex",
    });
    const composerInput = decodeGetComposerCapabilitiesInput({
      provider: "claudeAgent",
    });

    expect(skillsInput.cwd).toBe("/tmp/workspace");
    expect(skillsInput.threadId).toBe("thread-1");
    expect(skillsInput.forceReload).toBe(true);
    expect(pluginsInput.cwd).toBe("/tmp/workspace");
    expect(pluginsInput.threadId).toBe("thread-2");
    expect(modelsInput.provider).toBe("codex");
    expect(composerInput.provider).toBe("claudeAgent");
  });

  it("rejects whitespace-only discovery inputs", () => {
    expect(() =>
      decodeListSkillsInput({
        provider: "codex",
        cwd: "   ",
      }),
    ).toThrow();
    expect(() =>
      decodeListPluginsInput({
        provider: "codex",
        cwd: " /tmp/workspace ",
        threadId: "   ",
      }),
    ).toThrow();
  });

  it("accepts trimmed skills, plugins, and models results", () => {
    const skillsResult = decodeListSkillsResult({
      skills: [
        {
          name: " build ",
          description: " implementation helper ",
          path: " ~/.codex/skills/build.md ",
          enabled: true,
          scope: " project ",
          interface: {
            displayName: " Build ",
            shortDescription: " Scoped implementation work ",
          },
          dependencies: { npm: ["foo"] },
        },
      ],
      source: " cached ",
      cached: true,
    });
    const pluginsResult = decodeListPluginsResult({
      marketplaces: [
        {
          name: " official ",
          path: " ~/.codex/plugins ",
          interface: {
            displayName: " Official Marketplace ",
          },
          plugins: [
            {
              id: " plugin-1 ",
              name: " Plugin One ",
              source: {
                type: "local",
                path: " ./plugins/plugin-one ",
              },
              installed: true,
              enabled: true,
              installPolicy: "AVAILABLE",
              authPolicy: "ON_INSTALL",
              interface: {
                displayName: " Plugin One ",
                shortDescription: " Useful plugin ",
                capabilities: [" chat ", " tools "],
                screenshots: [" shot-1 "],
              },
            },
          ],
        },
      ],
      marketplaceLoadErrors: [
        {
          marketplacePath: " ~/.codex/plugins ",
          message: " failed to load ",
        },
      ],
      remoteSyncError: null,
      featuredPluginIds: [" plugin-1 "],
      source: " remote ",
      cached: false,
    });
    const modelsResult = decodeListModelsResult({
      models: [
        {
          slug: " gpt-5.4 ",
          name: " GPT-5.4 ",
        },
      ],
      source: " runtime ",
      cached: true,
    });

    expect(skillsResult.skills[0]?.name).toBe("build");
    expect(skillsResult.skills[0]?.path).toBe("~/.codex/skills/build.md");
    expect(skillsResult.skills[0]?.interface?.displayName).toBe("Build");
    expect(pluginsResult.marketplaces[0]?.name).toBe("official");
    expect(pluginsResult.marketplaces[0]?.plugins[0]?.source.path).toBe("./plugins/plugin-one");
    expect(pluginsResult.marketplaces[0]?.plugins[0]?.interface?.capabilities).toEqual([
      "chat",
      "tools",
    ]);
    expect(pluginsResult.featuredPluginIds).toEqual(["plugin-1"]);
    expect(modelsResult.models[0]?.slug).toBe("gpt-5.4");
    expect(modelsResult.models[0]?.name).toBe("GPT-5.4");
  });

  it("rejects malformed skills, plugins, and models results", () => {
    expect(() =>
      decodeListSkillsResult({
        skills: [
          {
            name: "build",
            path: "  ",
            enabled: true,
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      decodeListPluginsResult({
        marketplaces: [],
        marketplaceLoadErrors: [],
        remoteSyncError: "",
        featuredPluginIds: [],
      }),
    ).toThrow();
    expect(() =>
      decodeListModelsResult({
        models: [
          {
            slug: " ",
            name: " GPT-5.4 ",
          },
        ],
      }),
    ).toThrow();
  });
});
