import {
  type KeybindingCommand,
  type ProjectId,
  type ProjectScript,
  type ThreadId,
} from "@t3tools/contracts";
import { deriveTerminalCommandIdentity } from "@t3tools/shared/terminalThreads";
import { useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useCallback } from "react";

import { isElectron } from "../../env";
import { decodeProjectScriptKeybindingRule } from "../../lib/projectScriptKeybindings";
import { serverQueryKeys } from "../../lib/serverReactQuery";
import { newCommandId, randomUUID } from "../../lib/utils";
import { readNativeApi } from "../../nativeApi";
import {
  commandForProjectScript,
  nextProjectScriptId,
  projectScriptRuntimeEnv,
} from "../../projectScripts";
import { DEFAULT_THREAD_TERMINAL_ID, type Thread } from "../../types";
import { toastManager } from "../ui/toast";
import type { NewProjectScriptInput } from "../ProjectScriptsControl";

const SCRIPT_TERMINAL_COLS = 120;
const SCRIPT_TERMINAL_ROWS = 30;

interface ScriptTerminalMetadata {
  cliKind: "codex" | "claude" | null;
  label: string;
}

interface UseChatProjectScriptBindingsOptions {
  activeProject: {
    id: ProjectId;
    cwd: string;
    scripts: ProjectScript[];
  } | null;
  activeThread: Thread | undefined;
  activeThreadId: ThreadId | null;
  gitCwd: string | null;
  terminalState: {
    activeTerminalId: string;
    runningTerminalIds: string[];
    terminalIds: string[];
  };
  activateTerminal: (terminalId: string) => void;
  moveTerminalToNewGroup: (terminalId: string) => void;
  setLastInvokedScriptByProjectId: Dispatch<SetStateAction<Record<ProjectId, string>>>;
  setTerminalMetadata: (terminalId: string, metadata: ScriptTerminalMetadata) => void;
  setTerminalOpen: (open: boolean) => void;
  setThreadError: (threadId: ThreadId, error: string | null) => void;
}

export interface RunProjectScriptOptions {
  cwd?: string;
  env?: Record<string, string>;
  worktreePath?: string | null;
  preferNewTerminal?: boolean;
  rememberAsLastInvoked?: boolean;
}

interface UseChatProjectScriptBindingsResult {
  runProjectScript: (script: ProjectScript, options?: RunProjectScriptOptions) => Promise<void>;
  saveProjectScript: (input: NewProjectScriptInput) => Promise<void>;
  updateProjectScript: (scriptId: string, input: NewProjectScriptInput) => Promise<void>;
  deleteProjectScript: (scriptId: string) => Promise<void>;
}

// Keeps project script launch + CRUD mutations together so ChatView only wires the header and send flow.
export function useChatProjectScriptBindings(
  options: UseChatProjectScriptBindingsOptions,
): UseChatProjectScriptBindingsResult {
  const {
    activeProject,
    activeThread,
    activeThreadId,
    gitCwd,
    terminalState,
    activateTerminal,
    moveTerminalToNewGroup,
    setLastInvokedScriptByProjectId,
    setTerminalMetadata,
    setTerminalOpen,
    setThreadError,
  } = options;

  const queryClient = useQueryClient();

  const persistProjectScripts = useCallback(
    async (input: {
      projectId: ProjectId;
      nextScripts: ProjectScript[];
      keybinding?: string | null;
      keybindingCommand: KeybindingCommand;
    }) => {
      const api = readNativeApi();
      if (!api) return;

      await api.orchestration.dispatchCommand({
        type: "project.meta.update",
        commandId: newCommandId(),
        projectId: input.projectId,
        scripts: input.nextScripts,
      });

      const keybindingRule = decodeProjectScriptKeybindingRule({
        keybinding: input.keybinding,
        command: input.keybindingCommand,
      });

      if (isElectron && keybindingRule) {
        await api.server.upsertKeybinding(keybindingRule);
        await queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
      }
    },
    [queryClient],
  );

  const runProjectScript = useCallback(
    async (script: ProjectScript, options?: RunProjectScriptOptions) => {
      const api = readNativeApi();
      if (!api || !activeThreadId || !activeProject || !activeThread) return;
      if (options?.rememberAsLastInvoked !== false) {
        setLastInvokedScriptByProjectId((current) => {
          if (current[activeProject.id] === script.id) return current;
          return { ...current, [activeProject.id]: script.id };
        });
      }
      const targetCwd = options?.cwd ?? gitCwd ?? activeProject.cwd;
      const baseTerminalId =
        terminalState.activeTerminalId ||
        terminalState.terminalIds[0] ||
        DEFAULT_THREAD_TERMINAL_ID;
      const isBaseTerminalBusy = terminalState.runningTerminalIds.includes(baseTerminalId);
      const shouldCreateNewTerminal = Boolean(options?.preferNewTerminal) || isBaseTerminalBusy;
      const targetTerminalId = shouldCreateNewTerminal
        ? `terminal-${randomUUID()}`
        : baseTerminalId;

      setTerminalOpen(true);
      if (shouldCreateNewTerminal) {
        moveTerminalToNewGroup(targetTerminalId);
      } else {
        activateTerminal(targetTerminalId);
      }

      const runtimeEnv = projectScriptRuntimeEnv({
        project: {
          cwd: activeProject.cwd,
        },
        worktreePath: options?.worktreePath ?? activeThread.worktreePath ?? null,
        ...(options?.env ? { extraEnv: options.env } : {}),
      });
      const openTerminalInput: Parameters<typeof api.terminal.open>[0] = shouldCreateNewTerminal
        ? {
            threadId: activeThreadId,
            terminalId: targetTerminalId,
            cwd: targetCwd,
            env: runtimeEnv,
            cols: SCRIPT_TERMINAL_COLS,
            rows: SCRIPT_TERMINAL_ROWS,
          }
        : {
            threadId: activeThreadId,
            terminalId: targetTerminalId,
            cwd: targetCwd,
            env: runtimeEnv,
          };

      try {
        const terminalCommandIdentity = deriveTerminalCommandIdentity(script.command);
        await api.terminal.open(openTerminalInput);
        if (terminalCommandIdentity) {
          setTerminalMetadata(targetTerminalId, {
            cliKind: terminalCommandIdentity.cliKind,
            label: terminalCommandIdentity.title,
          });
        }
        await api.terminal.write({
          threadId: activeThreadId,
          terminalId: targetTerminalId,
          data: `${script.command}\r`,
        });
      } catch (error) {
        setThreadError(
          activeThreadId,
          error instanceof Error ? error.message : `Failed to run script "${script.name}".`,
        );
      }
    },
    [
      activeProject,
      activeThread,
      activeThreadId,
      activateTerminal,
      gitCwd,
      moveTerminalToNewGroup,
      setLastInvokedScriptByProjectId,
      setTerminalMetadata,
      setTerminalOpen,
      setThreadError,
      terminalState.activeTerminalId,
      terminalState.runningTerminalIds,
      terminalState.terminalIds,
    ],
  );

  const saveProjectScript = useCallback(
    async (input: NewProjectScriptInput) => {
      if (!activeProject) return;
      const nextId = nextProjectScriptId(
        input.name,
        activeProject.scripts.map((script) => script.id),
      );
      const nextScript: ProjectScript = {
        id: nextId,
        name: input.name,
        command: input.command,
        icon: input.icon,
        runOnWorktreeCreate: input.runOnWorktreeCreate,
      };
      const nextScripts = input.runOnWorktreeCreate
        ? [
            ...activeProject.scripts.map((script) =>
              script.runOnWorktreeCreate ? { ...script, runOnWorktreeCreate: false } : script,
            ),
            nextScript,
          ]
        : [...activeProject.scripts, nextScript];

      await persistProjectScripts({
        projectId: activeProject.id,
        nextScripts,
        keybinding: input.keybinding,
        keybindingCommand: commandForProjectScript(nextId),
      });
    },
    [activeProject, persistProjectScripts],
  );

  const updateProjectScript = useCallback(
    async (scriptId: string, input: NewProjectScriptInput) => {
      if (!activeProject) return;
      const existingScript = activeProject.scripts.find((script) => script.id === scriptId);
      if (!existingScript) {
        throw new Error("Script not found.");
      }

      const updatedScript: ProjectScript = {
        ...existingScript,
        name: input.name,
        command: input.command,
        icon: input.icon,
        runOnWorktreeCreate: input.runOnWorktreeCreate,
      };
      const nextScripts = activeProject.scripts.map((script) =>
        script.id === scriptId
          ? updatedScript
          : input.runOnWorktreeCreate
            ? { ...script, runOnWorktreeCreate: false }
            : script,
      );

      await persistProjectScripts({
        projectId: activeProject.id,
        nextScripts,
        keybinding: input.keybinding,
        keybindingCommand: commandForProjectScript(scriptId),
      });
    },
    [activeProject, persistProjectScripts],
  );

  const deleteProjectScript = useCallback(
    async (scriptId: string) => {
      if (!activeProject) return;
      const nextScripts = activeProject.scripts.filter((script) => script.id !== scriptId);
      const deletedName = activeProject.scripts.find((script) => script.id === scriptId)?.name;

      try {
        await persistProjectScripts({
          projectId: activeProject.id,
          nextScripts,
          keybinding: null,
          keybindingCommand: commandForProjectScript(scriptId),
        });
        toastManager.add({
          type: "success",
          title: `Deleted action "${deletedName ?? "Unknown"}"`,
        });
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Could not delete action",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      }
    },
    [activeProject, persistProjectScripts],
  );

  return {
    runProjectScript,
    saveProjectScript,
    updateProjectScript,
    deleteProjectScript,
  };
}
