import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { T3CODE_TERMINAL_CLI_KIND_ENV_KEY } from "@t3tools/shared/terminalThreads";

import { prepareManagedTerminalWrappers } from "./managedTerminalWrappers";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeExecutable(filePath: string): void {
  fs.writeFileSync(filePath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
}

function makeCaptureExecutable(filePath: string): void {
  fs.writeFileSync(
    filePath,
    `#!/bin/sh
set -eu
: "\${T3CODE_WRAPPER_CAPTURE:?}"
{
  printf 'argv0=%s\\n' "$0"
  _t3code_index=0
  for _t3code_arg in "$@"; do
    printf 'arg[%s]=%s\\n' "$_t3code_index" "$_t3code_arg"
    _t3code_index=$((_t3code_index + 1))
  done
  if [ -n "\${CODEX_HOME:-}" ]; then
    printf 'CODEX_HOME=%s\\n' "$CODEX_HOME"
  fi
  if [ -n "\${${T3CODE_TERMINAL_CLI_KIND_ENV_KEY}:-}" ]; then
    printf '${T3CODE_TERMINAL_CLI_KIND_ENV_KEY}=%s\\n' "$${T3CODE_TERMINAL_CLI_KIND_ENV_KEY}"
  fi
} > "$T3CODE_WRAPPER_CAPTURE"
`,
    { mode: 0o755 },
  );
}

describe("managedTerminalWrappers", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("shell-quotes managed wrapper paths that contain injection-prone characters", () => {
    const rootDir = makeTempDir("t3code managed wrappers root '$() ; -");
    const zshRootDir = makeTempDir("t3code managed zsh root '$() ; -");
    const binDir = makeTempDir("t3code managed bin '$() ; -");
    tempDirs.push(rootDir, zshRootDir, binDir);

    const codexTargetPath = path.join(binDir, "codex");
    const claudeTargetPath = path.join(binDir, "claude");
    makeExecutable(codexTargetPath);
    makeExecutable(claudeTargetPath);

    const hookScriptPath = path.join(rootDir, "notify-hook.sh");
    const claudeSettingsPath = path.join(rootDir, "claude-settings.json");

    const state = prepareManagedTerminalWrappers({
      baseEnv: {
        PATH: binDir,
        HOME: "/home/tester",
      },
      rootDir,
      zshRootDir,
    });

    expect(state).toEqual({
      binDir: rootDir,
      codexHomeDir: path.join(rootDir, "codex-home"),
      hookScriptPath,
      claudeSettingsPath,
      zshDir: zshRootDir,
      targetPathByCliKind: {
        codex: codexTargetPath,
        claude: claudeTargetPath,
      },
    });

    const codexWrapper = fs.readFileSync(path.join(rootDir, "codex"), "utf8");
    const claudeWrapper = fs.readFileSync(path.join(rootDir, "claude"), "utf8");
    const quotedCodexTargetPath = shellQuote(codexTargetPath);
    const quotedClaudeTargetPath = shellQuote(claudeTargetPath);
    const quotedHookScriptPath = shellQuote(hookScriptPath);
    const quotedClaudeSettingsPath = shellQuote(claudeSettingsPath);
    const quotedNotifyArg = shellQuote(`notify=["bash",${JSON.stringify(hookScriptPath)}]`);

    expect(codexWrapper).toContain(
      `export CODEX_HOME=${shellQuote(path.join(rootDir, "codex-home"))}`,
    );
    expect(codexWrapper).toContain(`if [ -f ${quotedHookScriptPath} ]; then`);
    expect(codexWrapper).toContain(
      `${quotedCodexTargetPath} --enable codex_hooks -c ${quotedNotifyArg} "$@"`,
    );

    expect(claudeWrapper).toContain(
      `# Managed claude wrapper injected by t3code terminal sessions.`,
    );
    expect(claudeWrapper).toContain(`export T3CODE_TERMINAL_CLI_KIND=${shellQuote("claude")}`);
    expect(claudeWrapper).toContain(
      `exec ${quotedClaudeTargetPath} --settings ${quotedClaudeSettingsPath} "$@"`,
    );
  });

  it("executes generated wrappers without interpreting shell metacharacters from managed paths", () => {
    const baseDir = makeTempDir("t3code managed wrappers exec-");
    tempDirs.push(baseDir);

    const markerPath = path.join(baseDir, "marker");
    const injectionSegment = `danger-' && touch "$T3CODE_MARKER" && echo '`;
    const binDir = path.join(baseDir, injectionSegment);
    const rootDir = path.join(baseDir, `${injectionSegment}-managed-root`);
    const zshRootDir = path.join(baseDir, `${injectionSegment}-managed-zsh`);
    fs.mkdirSync(binDir, { recursive: true });
    tempDirs.push(rootDir, zshRootDir);

    const codexTargetPath = path.join(binDir, "codex");
    const claudeTargetPath = path.join(binDir, "claude");
    makeCaptureExecutable(codexTargetPath);
    makeCaptureExecutable(claudeTargetPath);

    const state = prepareManagedTerminalWrappers({
      baseEnv: {
        PATH: binDir,
        HOME: "/home/tester",
      },
      rootDir,
      zshRootDir,
    });

    expect(state.targetPathByCliKind).toEqual({
      codex: codexTargetPath,
      claude: claudeTargetPath,
    });

    const claudeCapturePath = path.join(baseDir, "claude-capture.txt");
    const claudeResult = spawnSync(
      path.join(rootDir, "claude"),
      ["--passthrough", `plain-'";$USER`],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          T3CODE_MARKER: markerPath,
          T3CODE_WRAPPER_CAPTURE: claudeCapturePath,
        },
      },
    );

    expect(claudeResult.error).toBeUndefined();
    expect(claudeResult.status).toBe(0);
    expect(fs.existsSync(markerPath)).toBe(false);

    const claudeCapture = fs.readFileSync(claudeCapturePath, "utf8");
    expect(claudeCapture).toContain(`argv0=${claudeTargetPath}`);
    expect(claudeCapture).toContain("arg[0]=--settings");
    expect(claudeCapture).toContain(`arg[1]=${path.join(rootDir, "claude-settings.json")}`);
    expect(claudeCapture).toContain("arg[2]=--passthrough");
    expect(claudeCapture).toContain(`arg[3]=plain-'";$USER`);
    expect(claudeCapture).toContain(`${T3CODE_TERMINAL_CLI_KIND_ENV_KEY}=claude`);

    const codexCapturePath = path.join(baseDir, "codex-capture.txt");
    const codexResult = spawnSync(path.join(rootDir, "codex"), ["--user-arg"], {
      encoding: "utf8",
      env: {
        ...process.env,
        T3CODE_MARKER: markerPath,
        T3CODE_WRAPPER_CAPTURE: codexCapturePath,
      },
    });

    expect(codexResult.error).toBeUndefined();
    expect(codexResult.status).toBe(0);
    expect(fs.existsSync(markerPath)).toBe(false);

    const codexCapture = fs.readFileSync(codexCapturePath, "utf8");
    expect(codexCapture).toContain(`argv0=${codexTargetPath}`);
    expect(codexCapture).toContain("arg[0]=--enable");
    expect(codexCapture).toContain("arg[1]=codex_hooks");
    expect(codexCapture).toContain("arg[2]=-c");
    expect(codexCapture).toContain(
      `arg[3]=notify=["bash",${JSON.stringify(path.join(rootDir, "notify-hook.sh"))}]`,
    );
    expect(codexCapture).toContain("arg[4]=--user-arg");
    expect(codexCapture).toContain(`CODEX_HOME=${path.join(rootDir, "codex-home")}`);
    expect(codexCapture).toContain(`${T3CODE_TERMINAL_CLI_KIND_ENV_KEY}=codex`);
  });

  it("rejects wrapper literals containing newlines before embedding them into shell scripts", () => {
    const baseDir = makeTempDir("t3code managed wrappers invalid-");
    const binDir = path.join(baseDir, "bin");
    fs.mkdirSync(binDir, { recursive: true });
    tempDirs.push(baseDir);

    makeExecutable(path.join(binDir, "claude"));

    expect(() =>
      prepareManagedTerminalWrappers({
        baseEnv: {
          PATH: binDir,
          HOME: "/home/tester",
        },
        rootDir: path.join(baseDir, "managed\nroot"),
        zshRootDir: path.join(baseDir, "managed-zsh"),
      }),
    ).toThrow(
      "Managed terminal wrapper literals must not contain NUL, carriage return, or newline characters.",
    );
  });
});
