import { describe, expect, it } from "vitest";

import {
  consumeTerminalIdentityInput,
  deriveTerminalCommandIdentity,
  deriveTerminalOutputIdentity,
  deriveTerminalProcessIdentity,
  deriveTerminalTitleSignalIdentity,
  GENERIC_TERMINAL_THREAD_TITLE,
  reconcileTerminalCommandIdentity,
  resolveTerminalVisualIdentity,
} from "./terminalThreads";

const CODEX_IDENTITY = {
  cliKind: "codex",
  iconKey: "openai",
  title: "Codex CLI",
} as const;

const CLAUDE_IDENTITY = {
  cliKind: "claude",
  iconKey: "claude",
  title: "Claude Code",
} as const;

describe("terminalThreads", () => {
  describe("deriveTerminalCommandIdentity", () => {
    it("normalizes shell prefixes and executor commands for managed CLIs", () => {
      expect(deriveTerminalCommandIdentity("FOO=1 env BAR=2 sudo bunx @openai/codex")).toEqual(
        CODEX_IDENTITY,
      );
      expect(deriveTerminalCommandIdentity("npx @anthropic-ai/claude-code")).toEqual(
        CLAUDE_IDENTITY,
      );
      expect(deriveTerminalCommandIdentity("pnpm dlx @openai/codex")).toEqual(CODEX_IDENTITY);
      expect(deriveTerminalCommandIdentity("npm exec @anthropic-ai/claude-code")).toEqual(
        CLAUDE_IDENTITY,
      );
    });
  });

  describe("consumeTerminalIdentityInput", () => {
    it("parses incremental input and preserves the submitted identity across CRLF", () => {
      let state = consumeTerminalIdentityInput("", "co");
      expect(state).toEqual({ buffer: "co", identity: null });

      state = consumeTerminalIdentityInput(state.buffer, "dex");
      expect(state).toEqual({ buffer: "codex", identity: null });

      state = consumeTerminalIdentityInput(state.buffer, "\r\n");
      expect(state).toEqual({ buffer: "", identity: CODEX_IDENTITY });
    });

    it("applies tabs, backspace, and delete before deriving an identity", () => {
      let state = consumeTerminalIdentityInput("", "claudx\b");
      expect(state).toEqual({ buffer: "claud", identity: null });

      state = consumeTerminalIdentityInput(state.buffer, "e\tcodf\u007fe\r");
      expect(state).toEqual({ buffer: "", identity: CLAUDE_IDENTITY });
    });

    it("clears pending input on ctrl-c, ctrl-d, and ctrl-u", () => {
      let state = consumeTerminalIdentityInput("", "codex");
      state = consumeTerminalIdentityInput(state.buffer, "\u0015");
      expect(state).toEqual({ buffer: "", identity: null });

      state = consumeTerminalIdentityInput(state.buffer, "git");
      state = consumeTerminalIdentityInput(state.buffer, "\u0004");
      expect(state).toEqual({ buffer: "", identity: null });

      state = consumeTerminalIdentityInput(state.buffer, "claude");
      state = consumeTerminalIdentityInput(state.buffer, "\u0003codex\r");
      expect(state).toEqual({ buffer: "", identity: CODEX_IDENTITY });
    });

    it("ignores escape sequences without dropping surrounding printable input", () => {
      let state = consumeTerminalIdentityInput("", "cod");
      state = consumeTerminalIdentityInput(state.buffer, "ex\u001b[A\r");
      expect(state).toEqual({ buffer: "", identity: CODEX_IDENTITY });
    });
  });

  describe("provider attribution", () => {
    it("keeps provider identity sticky across process, output, and title signals", () => {
      const processIdentity = deriveTerminalProcessIdentity(
        "node /tmp/project/node_modules/@openai/codex/dist/cli.mjs",
      );
      expect(processIdentity).toEqual(CODEX_IDENTITY);

      const genericIdentity = deriveTerminalCommandIdentity("git status");
      expect(genericIdentity).toEqual({
        cliKind: null,
        iconKey: "terminal",
        title: "git status",
      });

      const stickyAfterProcess = reconcileTerminalCommandIdentity({
        currentCliKind: processIdentity?.cliKind,
        currentTitle: processIdentity?.title,
        nextCliKind: genericIdentity?.cliKind,
        nextTitle: genericIdentity?.title ?? "git status",
      });
      expect(stickyAfterProcess).toEqual(CODEX_IDENTITY);

      const outputIdentity = deriveTerminalOutputIdentity("\u001b[32mOpenAI Codex v0.1.0\u001b[0m");
      expect(outputIdentity).toEqual(CODEX_IDENTITY);

      const stickyAfterOutput = reconcileTerminalCommandIdentity({
        currentCliKind: stickyAfterProcess.cliKind,
        currentTitle: stickyAfterProcess.title,
        nextCliKind: outputIdentity?.cliKind,
        nextTitle: outputIdentity?.title ?? "Codex CLI",
      });
      expect(stickyAfterOutput).toEqual(CODEX_IDENTITY);

      const titleIdentity = deriveTerminalTitleSignalIdentity("Claude Code");
      expect(titleIdentity).toEqual(CLAUDE_IDENTITY);

      const promotedByTitleSignal = reconcileTerminalCommandIdentity({
        currentCliKind: stickyAfterOutput.cliKind,
        currentTitle: stickyAfterOutput.title,
        nextCliKind: titleIdentity?.cliKind,
        nextTitle: titleIdentity?.title ?? "Claude Code",
      });
      expect(promotedByTitleSignal).toEqual(CLAUDE_IDENTITY);
    });

    it("infers stickiness from the persisted provider title when cli kind is omitted", () => {
      const genericIdentity = deriveTerminalCommandIdentity("git status");
      expect(
        reconcileTerminalCommandIdentity({
          currentTitle: "Codex CLI",
          nextCliKind: genericIdentity?.cliKind,
          nextTitle: genericIdentity?.title ?? "git status",
        }),
      ).toEqual(CODEX_IDENTITY);
    });
  });

  describe("resolveTerminalVisualIdentity", () => {
    it("falls back to the provided generic title and idle terminal icon", () => {
      expect(
        resolveTerminalVisualIdentity({
          fallbackTitle: GENERIC_TERMINAL_THREAD_TITLE,
          title: "   ",
        }),
      ).toEqual({
        cliKind: null,
        iconKey: "terminal",
        state: "idle",
        title: GENERIC_TERMINAL_THREAD_TITLE,
      });
    });

    it("uses provider defaults when cli kind is known or inferred", () => {
      expect(
        resolveTerminalVisualIdentity({
          cliKind: "claude",
          fallbackTitle: GENERIC_TERMINAL_THREAD_TITLE,
          isRunning: true,
          title: "   ",
        }),
      ).toEqual({
        cliKind: "claude",
        iconKey: "claude",
        state: "running",
        title: "Claude Code",
      });

      expect(
        resolveTerminalVisualIdentity({
          fallbackTitle: GENERIC_TERMINAL_THREAD_TITLE,
          state: "attention",
          title: " codex cli ",
        }),
      ).toEqual({
        cliKind: "codex",
        iconKey: "openai",
        state: "attention",
        title: "codex cli",
      });
    });
  });
});
