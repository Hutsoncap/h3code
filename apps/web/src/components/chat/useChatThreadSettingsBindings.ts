// FILE: useChatThreadSettingsBindings.ts
// Purpose: Own ChatView's draft/server thread setting updates for runtime and interaction modes.
// Layer: ChatView hook
// Depends on: Native orchestration commands plus caller-owned draft-thread setters.

import {
  type ModelSelection,
  type ProviderInteractionMode,
  RuntimeMode,
  ThreadId,
} from "@t3tools/contracts";
import { useCallback } from "react";

import { readNativeApi } from "../../nativeApi";
import { newCommandId } from "../../lib/utils";
import type { Thread } from "../../types";

interface PersistThreadSettingsInput {
  threadId: ThreadId;
  createdAt: string;
  modelSelection?: ModelSelection;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
}

interface UseChatThreadSettingsBindingsOptions {
  threadId: ThreadId;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
  isLocalDraftThread: boolean;
  serverThread: Thread | null;
  scheduleComposerFocus: () => void;
  setComposerDraftRuntimeMode: (threadId: ThreadId, mode: RuntimeMode) => void;
  setComposerDraftInteractionMode: (threadId: ThreadId, mode: ProviderInteractionMode) => void;
  setDraftThreadContext: (
    threadId: ThreadId,
    context: {
      runtimeMode?: RuntimeMode;
      interactionMode?: ProviderInteractionMode;
    },
  ) => void;
}

interface UseChatThreadSettingsBindingsResult {
  handleRuntimeModeChange: (mode: RuntimeMode) => void;
  handleInteractionModeChange: (mode: ProviderInteractionMode) => void;
  toggleInteractionMode: () => void;
  setPlanMode: (enabled: boolean) => void;
  persistThreadSettingsForNextTurn: (input: PersistThreadSettingsInput) => Promise<void>;
}

// Consolidates thread setting state transitions so ChatView can treat mode controls as a single seam.
export function useChatThreadSettingsBindings(
  options: UseChatThreadSettingsBindingsOptions,
): UseChatThreadSettingsBindingsResult {
  const {
    threadId,
    runtimeMode,
    interactionMode,
    isLocalDraftThread,
    serverThread,
    scheduleComposerFocus,
    setComposerDraftRuntimeMode,
    setComposerDraftInteractionMode,
    setDraftThreadContext,
  } = options;

  const handleRuntimeModeChange = useCallback(
    (mode: RuntimeMode) => {
      if (mode === runtimeMode) return;
      setComposerDraftRuntimeMode(threadId, mode);
      if (isLocalDraftThread) {
        setDraftThreadContext(threadId, { runtimeMode: mode });
      }
      scheduleComposerFocus();
    },
    [
      isLocalDraftThread,
      runtimeMode,
      scheduleComposerFocus,
      setComposerDraftRuntimeMode,
      setDraftThreadContext,
      threadId,
    ],
  );

  const handleInteractionModeChange = useCallback(
    (mode: ProviderInteractionMode) => {
      if (mode === interactionMode) return;
      setComposerDraftInteractionMode(threadId, mode);
      if (isLocalDraftThread) {
        setDraftThreadContext(threadId, { interactionMode: mode });
      }
      scheduleComposerFocus();
    },
    [
      interactionMode,
      isLocalDraftThread,
      scheduleComposerFocus,
      setComposerDraftInteractionMode,
      setDraftThreadContext,
      threadId,
    ],
  );

  const toggleInteractionMode = useCallback(() => {
    handleInteractionModeChange(interactionMode === "plan" ? "default" : "plan");
  }, [handleInteractionModeChange, interactionMode]);

  const setPlanMode = useCallback(
    (enabled: boolean) => {
      handleInteractionModeChange(enabled ? "plan" : "default");
    },
    [handleInteractionModeChange],
  );

  const persistThreadSettingsForNextTurn = useCallback(
    async (input: PersistThreadSettingsInput) => {
      if (!serverThread) {
        return;
      }
      const api = readNativeApi();
      if (!api) {
        return;
      }

      if (
        input.modelSelection !== undefined &&
        (input.modelSelection.model !== serverThread.modelSelection.model ||
          input.modelSelection.provider !== serverThread.modelSelection.provider ||
          JSON.stringify(input.modelSelection.options ?? null) !==
            JSON.stringify(serverThread.modelSelection.options ?? null))
      ) {
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId: input.threadId,
          modelSelection: input.modelSelection,
        });
      }

      if (input.runtimeMode !== serverThread.runtimeMode) {
        await api.orchestration.dispatchCommand({
          type: "thread.runtime-mode.set",
          commandId: newCommandId(),
          threadId: input.threadId,
          runtimeMode: input.runtimeMode,
          createdAt: input.createdAt,
        });
      }

      if (input.interactionMode !== serverThread.interactionMode) {
        await api.orchestration.dispatchCommand({
          type: "thread.interaction-mode.set",
          commandId: newCommandId(),
          threadId: input.threadId,
          interactionMode: input.interactionMode,
          createdAt: input.createdAt,
        });
      }
    },
    [serverThread],
  );

  return {
    handleRuntimeModeChange,
    handleInteractionModeChange,
    toggleInteractionMode,
    setPlanMode,
    persistThreadSettingsForNextTurn,
  };
}
