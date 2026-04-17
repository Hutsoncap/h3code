import { describe, expect, it } from "vitest";

import {
  parseModelListResponse,
  parsePluginListResponse,
  parsePluginReadResponse,
  parseSkillsListResponse,
} from "./discoveryParsing";

describe("parseSkillsListResponse", () => {
  it("prefers cwd-scoped skills payloads and sorts the result", () => {
    expect(
      parseSkillsListResponse(
        {
          result: {
            data: [
              {
                cwd: "/repo",
                skills: [
                  { name: "zebra", path: "/repo/zebra", enabled: true },
                  { name: "alpha", path: "/repo/alpha", enabled: true },
                ],
              },
            ],
          },
        },
        "/repo",
      ),
    ).toEqual([
      { name: "alpha", path: "/repo/alpha", enabled: true },
      { name: "zebra", path: "/repo/zebra", enabled: true },
    ]);
  });
});

describe("parsePluginListResponse", () => {
  it("parses marketplace metadata, plugins, and load errors", () => {
    expect(
      parsePluginListResponse({
        result: {
          marketplaces: [
            {
              name: "Built-ins",
              path: "/plugins",
              interface: { displayName: "Built-ins" },
              plugins: [
                {
                  id: "plugin-1",
                  name: "Plugin 1",
                  source: { path: "/plugins/plugin-1" },
                  installPolicy: "AVAILABLE",
                  authPolicy: "ON_USE",
                  installed: true,
                  enabled: true,
                },
              ],
            },
          ],
          marketplaceLoadErrors: [{ marketplacePath: "/broken", message: "failed to load" }],
          featuredPluginIds: ["plugin-1"],
          remoteSyncError: "temporary failure",
        },
      }),
    ).toEqual({
      marketplaces: [
        {
          name: "Built-ins",
          path: "/plugins",
          interface: { displayName: "Built-ins" },
          plugins: [
            {
              id: "plugin-1",
              name: "Plugin 1",
              source: { type: "local", path: "/plugins/plugin-1" },
              installPolicy: "AVAILABLE",
              authPolicy: "ON_USE",
              installed: true,
              enabled: true,
            },
          ],
        },
      ],
      marketplaceLoadErrors: [{ marketplacePath: "/broken", message: "failed to load" }],
      remoteSyncError: "temporary failure",
      featuredPluginIds: ["plugin-1"],
    });
  });
});

describe("parsePluginReadResponse", () => {
  it("parses plugin details, skills, apps, and MCP servers", () => {
    expect(
      parsePluginReadResponse({
        result: {
          plugin: {
            marketplaceName: "Built-ins",
            marketplacePath: "/plugins",
            summary: {
              id: "plugin-1",
              name: "Plugin 1",
              source: { path: "/plugins/plugin-1" },
              installPolicy: "AVAILABLE",
              authPolicy: "ON_USE",
              installed: true,
              enabled: true,
            },
            description: "Plugin description",
            skills: [{ name: "alpha", path: "/skills/alpha", enabled: true }],
            apps: [{ id: "app-1", name: "App 1", needsAuth: true }],
            mcpServers: ["server-1"],
          },
        },
      }),
    ).toEqual({
      marketplaceName: "Built-ins",
      marketplacePath: "/plugins",
      summary: {
        id: "plugin-1",
        name: "Plugin 1",
        source: { type: "local", path: "/plugins/plugin-1" },
        installPolicy: "AVAILABLE",
        authPolicy: "ON_USE",
        installed: true,
        enabled: true,
      },
      description: "Plugin description",
      skills: [{ name: "alpha", path: "/skills/alpha", enabled: true }],
      apps: [{ id: "app-1", name: "App 1", needsAuth: true }],
      mcpServers: ["server-1"],
    });
  });
});

describe("parseModelListResponse", () => {
  it("accepts either id or slug model shapes", () => {
    expect(
      parseModelListResponse({
        result: {
          data: [{ id: "gpt-5.3-codex", name: "GPT-5.3 Codex" }, { slug: "gpt-5.3-codex-spark" }],
        },
      }),
    ).toEqual([
      { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
      { slug: "gpt-5.3-codex-spark", name: "gpt-5.3-codex-spark" },
    ]);
  });
});
