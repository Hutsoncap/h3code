import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { ServerConfig, ServerProviderStatus, ServerVoiceTranscriptionInput } from "./server";

function decodeSync<S extends Schema.Top>(schema: S, input: unknown): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never)(input) as Schema.Schema.Type<S>;
}

describe("ServerProviderStatus", () => {
  it("parses provider health snapshots with optional voice transcription metadata", () => {
    const parsed = decodeSync(ServerProviderStatus, {
      provider: "codex",
      status: "warning",
      available: false,
      authStatus: "unknown",
      voiceTranscriptionAvailable: false,
      checkedAt: "2026-04-17T12:34:56.000Z",
      message: " Needs login ",
    });

    expect(parsed.provider).toBe("codex");
    expect(parsed.status).toBe("warning");
    expect(parsed.voiceTranscriptionAvailable).toBe(false);
    expect(parsed.message).toBe("Needs login");
  });

  it("rejects unknown auth status values", () => {
    expect(() =>
      decodeSync(ServerProviderStatus, {
        provider: "claudeAgent",
        status: "ready",
        available: true,
        authStatus: "signed-in",
        checkedAt: "2026-04-17T12:34:56.000Z",
      }),
    ).toThrow();
  });
});

describe("ServerConfig", () => {
  it("parses config snapshots with keybinding issues, provider statuses, and editors", () => {
    const parsed = decodeSync(ServerConfig, {
      cwd: " /repo ",
      homeDir: " /Users/tester ",
      worktreesDir: " /repo/.worktrees ",
      keybindingsConfigPath: " /repo/.config/keybindings.json ",
      keybindings: [
        {
          command: "terminal.toggle",
          shortcut: {
            key: "j",
            metaKey: false,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            modKey: true,
          },
        },
      ],
      issues: [
        {
          kind: "keybindings.malformed-config",
          message: " Invalid JSON ",
        },
        {
          kind: "keybindings.invalid-entry",
          message: " Duplicate shortcut ",
          index: 2,
        },
      ],
      providers: [
        {
          provider: "codex",
          status: "ready",
          available: true,
          authStatus: "authenticated",
          voiceTranscriptionAvailable: true,
          checkedAt: "2026-04-17T12:34:56.000Z",
        },
        {
          provider: "claudeAgent",
          status: "error",
          available: false,
          authStatus: "unauthenticated",
          checkedAt: "2026-04-17T12:35:56.000Z",
          message: " Sign in required ",
        },
      ],
      availableEditors: ["vscode", "zed"],
    });

    expect(parsed.cwd).toBe("/repo");
    expect(parsed.homeDir).toBe("/Users/tester");
    expect(parsed.issues).toHaveLength(2);
    expect(parsed.issues[0]?.message).toBe("Invalid JSON");
    expect(parsed.providers).toHaveLength(2);
    expect(parsed.providers[1]?.message).toBe("Sign in required");
    expect(parsed.availableEditors).toEqual(["vscode", "zed"]);
  });
});

describe("ServerVoiceTranscriptionInput", () => {
  it("parses transcribe requests with optional thread ids", () => {
    const parsed = decodeSync(ServerVoiceTranscriptionInput, {
      provider: "codex",
      cwd: " /tmp/workspace ",
      threadId: " thread-1 ",
      mimeType: " audio/wav ",
      sampleRateHz: 16_000,
      durationMs: 2_500,
      audioBase64: " UklGRigAAABXQVZF ",
    });

    expect(parsed.cwd).toBe("/tmp/workspace");
    expect(parsed.threadId).toBe("thread-1");
    expect(parsed.mimeType).toBe("audio/wav");
    expect(parsed.audioBase64).toBe("UklGRigAAABXQVZF");
  });

  it("rejects negative sample rates", () => {
    expect(() =>
      decodeSync(ServerVoiceTranscriptionInput, {
        provider: "codex",
        cwd: "/tmp/workspace",
        mimeType: "audio/wav",
        sampleRateHz: -1,
        durationMs: 2_500,
        audioBase64: "UklGRigAAABXQVZF",
      }),
    ).toThrow();
  });

  it("rejects mime types longer than 100 characters", () => {
    expect(() =>
      decodeSync(ServerVoiceTranscriptionInput, {
        provider: "claudeAgent",
        cwd: "/tmp/workspace",
        mimeType: `audio/${"x".repeat(95)}`,
        sampleRateHz: 16_000,
        durationMs: 2_500,
        audioBase64: "UklGRigAAABXQVZF",
      }),
    ).toThrow();
  });
});
