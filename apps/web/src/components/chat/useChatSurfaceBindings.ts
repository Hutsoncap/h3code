// FILE: useChatSurfaceBindings.ts
// Purpose: Own ChatView's remaining surface/environment control callbacks and derived shell state.
// Layer: ChatView hook
// Depends on: provider status cache, diff/browser router navigation, and thread error routing.

import { type ProviderKind, type ServerProviderStatus, type ThreadId } from "@t3tools/contracts";
import { type QueryClient } from "@tanstack/react-query";
import { type useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";

import { projectScriptRuntimeEnv } from "~/projectScripts";
import { serverQueryKeys } from "~/lib/serverReactQuery";
import { readNativeApi } from "~/nativeApi";
import { stripDiffSearchParams } from "../../diffRouteSearch";
import { useStore } from "../../store";
import { type Thread } from "../../types";
import { toastManager } from "../ui/toast";

interface UseChatSurfaceBindingsOptions {
  activeProjectCwd: string | null;
  activeThread: Thread | undefined;
  browserOpen: boolean;
  branchesIsRepo: boolean | undefined;
  diffEnvironmentPending: boolean;
  diffOpen: boolean;
  navigate: ReturnType<typeof useNavigate>;
  onToggleBrowserPanel?: (() => void) | undefined;
  onToggleDiffPanel?: (() => void) | undefined;
  providerStatuses: ReadonlyArray<ServerProviderStatus>;
  queryClient: QueryClient;
  selectedProvider: ProviderKind;
  setLocalDraftErrorsByThreadId: Dispatch<SetStateAction<Record<ThreadId, string | null>>>;
  setStoreThreadError: (threadId: ThreadId, error: string | null) => void;
  threadId: ThreadId;
}

interface UseChatSurfaceBindingsResult {
  activeProviderStatus: ServerProviderStatus | null;
  dismissActiveThreadError: () => void;
  envLocked: boolean;
  hasNativeUserMessages: boolean;
  isGitRepo: boolean;
  onToggleBrowser: () => void;
  onToggleDiff: () => void;
  refreshVoiceStatus: () => void;
  setThreadError: (targetThreadId: ThreadId | null, error: string | null) => void;
  threadTerminalRuntimeEnv: Record<string, string>;
  voiceProviderStatus: ServerProviderStatus | null;
}

export function useChatSurfaceBindings(
  options: UseChatSurfaceBindingsOptions,
): UseChatSurfaceBindingsResult {
  const {
    activeProjectCwd,
    activeThread,
    browserOpen,
    branchesIsRepo,
    diffEnvironmentPending,
    diffOpen,
    navigate,
    onToggleBrowserPanel,
    onToggleDiffPanel,
    providerStatuses,
    queryClient,
    selectedProvider,
    setLocalDraftErrorsByThreadId,
    setStoreThreadError,
    threadId,
  } = options;

  const activeProviderStatus = useMemo(
    () => providerStatuses.find((status) => status.provider === selectedProvider) ?? null,
    [providerStatuses, selectedProvider],
  );
  const voiceProviderStatus = useMemo(
    () => providerStatuses.find((status) => status.provider === "codex") ?? null,
    [providerStatuses],
  );

  const refreshVoiceStatus = useCallback(() => {
    const api = readNativeApi();
    if (!api) return;
    void api.server
      .refreshProviders()
      .then((result) => {
        queryClient.setQueryData(serverQueryKeys.config(), (current) =>
          current ? { ...current, providers: result.providers } : current,
        );
      })
      .catch((error) => {
        toastManager.add({
          type: "error",
          title: "Unable to refresh provider status",
          description:
            error instanceof Error ? error.message : "Unknown error refreshing provider status.",
        });
      });
  }, [queryClient]);

  const hasNativeUserMessages = useMemo(
    () =>
      activeThread?.messages.some(
        (message) => message.role === "user" && message.source === "native",
      ) ?? false,
    [activeThread?.messages],
  );
  const threadTerminalRuntimeEnv = useMemo(() => {
    if (!activeProjectCwd) return {};
    return projectScriptRuntimeEnv({
      project: { cwd: activeProjectCwd },
      worktreePath: activeThread?.worktreePath ?? null,
    });
  }, [activeProjectCwd, activeThread?.worktreePath]);
  const isGitRepo = branchesIsRepo ?? true;

  const onToggleDiff = useCallback(() => {
    if (diffEnvironmentPending && !diffOpen) {
      return;
    }
    if (onToggleDiffPanel) {
      onToggleDiffPanel();
      return;
    }
    void navigate({
      to: "/$threadId",
      params: { threadId },
      replace: true,
      search: (previous) => {
        const rest = stripDiffSearchParams(previous);
        return diffOpen
          ? { ...rest, panel: undefined, diff: undefined }
          : { ...rest, panel: "diff", diff: "1" };
      },
    });
  }, [diffEnvironmentPending, diffOpen, navigate, onToggleDiffPanel, threadId]);

  const onToggleBrowser = useCallback(() => {
    if (onToggleBrowserPanel) {
      onToggleBrowserPanel();
      return;
    }
    void navigate({
      to: "/$threadId",
      params: { threadId },
      replace: true,
      search: (previous) => {
        const rest = stripDiffSearchParams(previous);
        return browserOpen ? { ...rest, panel: undefined } : { ...rest, panel: "browser" };
      },
    });
  }, [browserOpen, navigate, onToggleBrowserPanel, threadId]);

  const envLocked = Boolean(
    activeThread &&
    (activeThread.messages.length > 0 ||
      (activeThread.session !== null && activeThread.session.status !== "closed")),
  );

  const setThreadError = useCallback(
    (targetThreadId: ThreadId | null, error: string | null) => {
      if (!targetThreadId) return;
      if (useStore.getState().threads.some((thread) => thread.id === targetThreadId)) {
        setStoreThreadError(targetThreadId, error);
        return;
      }
      setLocalDraftErrorsByThreadId((existing) => {
        if ((existing[targetThreadId] ?? null) === error) {
          return existing;
        }
        return {
          ...existing,
          [targetThreadId]: error,
        };
      });
    },
    [setLocalDraftErrorsByThreadId, setStoreThreadError],
  );

  const dismissActiveThreadError = useCallback(() => {
    if (!activeThread) return;
    setThreadError(activeThread.id, null);
  }, [activeThread, setThreadError]);

  return {
    activeProviderStatus,
    dismissActiveThreadError,
    envLocked,
    hasNativeUserMessages,
    isGitRepo,
    onToggleBrowser,
    onToggleDiff,
    refreshVoiceStatus,
    setThreadError,
    threadTerminalRuntimeEnv,
    voiceProviderStatus,
  };
}
