import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  CLAUDE_CODE_EFFORT_OPTIONS,
  ClaudeModelOptions,
  CODEX_REASONING_EFFORT_OPTIONS,
  CodexModelOptions,
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_OPTIONS_BY_PROVIDER,
  MODEL_SLUG_ALIASES_BY_PROVIDER,
  ProviderModelOptions,
} from "./model";

function decodeSync<S extends Schema.Top>(schema: S, input: unknown): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never)(input) as Schema.Schema.Type<S>;
}

describe("CodexModelOptions", () => {
  it("accepts every codex reasoning effort value", () => {
    for (const reasoningEffort of CODEX_REASONING_EFFORT_OPTIONS) {
      const parsed = decodeSync(CodexModelOptions, {
        reasoningEffort,
        fastMode: true,
      });

      expect(parsed.reasoningEffort).toBe(reasoningEffort);
      expect(parsed.fastMode).toBe(true);
    }
  });

  it("rejects claude-only effort values", () => {
    for (const reasoningEffort of ["max", "ultrathink"]) {
      expect(() =>
        decodeSync(CodexModelOptions, {
          reasoningEffort,
        }),
      ).toThrow();
    }
  });

  it("rejects claude-only option fields", () => {
    expect(() =>
      decodeSync(CodexModelOptions, {
        reasoningEffort: "high",
        effort: "max",
        thinking: true,
      }),
    ).toThrow();
  });
});

describe("ClaudeModelOptions", () => {
  it("accepts every claude effort value", () => {
    for (const effort of CLAUDE_CODE_EFFORT_OPTIONS) {
      const parsed = decodeSync(ClaudeModelOptions, {
        effort,
        thinking: true,
        fastMode: effort === "max",
      });

      expect(parsed.effort).toBe(effort);
      expect(parsed.thinking).toBe(true);
    }
  });

  it("rejects codex-only effort values", () => {
    expect(() =>
      decodeSync(ClaudeModelOptions, {
        effort: "xhigh",
      }),
    ).toThrow();
  });

  it("rejects codex-only option fields", () => {
    expect(() =>
      decodeSync(ClaudeModelOptions, {
        effort: "high",
        reasoningEffort: "medium",
      }),
    ).toThrow();
  });
});

describe("ProviderModelOptions", () => {
  it("accepts valid provider-specific option bags", () => {
    const parsed = decodeSync(ProviderModelOptions, {
      codex: {
        reasoningEffort: "xhigh",
        fastMode: true,
      },
      claudeAgent: {
        thinking: true,
        effort: "ultrathink",
      },
    });

    expect(parsed.codex?.reasoningEffort).toBe("xhigh");
    expect(parsed.codex?.fastMode).toBe(true);
    expect(parsed.claudeAgent?.thinking).toBe(true);
    expect(parsed.claudeAgent?.effort).toBe("ultrathink");
  });

  it("rejects malformed cross-provider nested option bags", () => {
    expect(() =>
      decodeSync(ProviderModelOptions, {
        codex: {
          effort: "high",
        },
      }),
    ).toThrow();

    expect(() =>
      decodeSync(ProviderModelOptions, {
        claudeAgent: {
          reasoningEffort: "high",
        },
      }),
    ).toThrow();
  });
});

describe("model constants", () => {
  it("keeps each default model slug within the provider catalog", () => {
    for (const provider of Object.keys(MODEL_OPTIONS_BY_PROVIDER) as Array<
      keyof typeof MODEL_OPTIONS_BY_PROVIDER
    >) {
      const slugs = new Set<string>(MODEL_OPTIONS_BY_PROVIDER[provider].map((model) => model.slug));
      expect(slugs.has(DEFAULT_MODEL_BY_PROVIDER[provider])).toBe(true);
    }
  });

  it("keeps every alias target within the provider catalog", () => {
    for (const provider of Object.keys(MODEL_SLUG_ALIASES_BY_PROVIDER) as Array<
      keyof typeof MODEL_SLUG_ALIASES_BY_PROVIDER
    >) {
      const slugs = new Set<string>(MODEL_OPTIONS_BY_PROVIDER[provider].map((model) => model.slug));
      for (const target of Object.values(MODEL_SLUG_ALIASES_BY_PROVIDER[provider])) {
        expect(slugs.has(target)).toBe(true);
      }
    }
  });
});
