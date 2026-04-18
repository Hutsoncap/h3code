// FILE: useChatComposerModelBindings.ts
// Purpose: Own ChatView's provider-model, traits, and fast-mode composer bindings.
// Layer: ChatView hook
// Depends on: composer draft setters plus provider trait rendering helpers.

import {
  type ModelSelection,
  type ModelSlug,
  type ProviderKind,
  type ProviderModelOptions,
  type ThreadId,
} from "@t3tools/contracts";
import { type MutableRefObject, type ReactNode, useCallback } from "react";

import { resolveAppModelSelection } from "../../appSettings";
import {
  collapseExpandedComposerCursor,
  detectComposerTrigger,
  type ComposerTrigger,
} from "../../composer-logic";
import { useComposerDraftStore } from "../../composerDraftStore";
import { buildNextProviderOptions } from "../../providerModelOptions";
import type { Thread } from "../../types";
import { renderProviderTraitsPicker } from "./composerProviderRegistry";
import { getComposerTraitSelection } from "./composerTraits";

interface UseChatComposerModelBindingsOptions {
  activeThread: Thread | undefined;
  composerModelOptions: ProviderModelOptions | null;
  customModelsByProvider: Record<ProviderKind, readonly string[]>;
  lockedProvider: ProviderKind | null;
  prompt: string;
  promptRef: MutableRefObject<string>;
  scheduleComposerFocus: () => void;
  selectedModel: ModelSlug;
  selectedProvider: ProviderKind;
  setComposerCursor: (cursor: number) => void;
  setComposerDraftModelSelection: ReturnType<
    typeof useComposerDraftStore.getState
  >["setModelSelection"];
  setComposerDraftProviderModelOptions: ReturnType<
    typeof useComposerDraftStore.getState
  >["setProviderModelOptions"];
  setComposerTrigger: (trigger: ComposerTrigger | null) => void;
  setPrompt: (prompt: string) => void;
  setStickyComposerModelSelection: ReturnType<
    typeof useComposerDraftStore.getState
  >["setStickyModelSelection"];
  threadId: ThreadId;
}

interface UseChatComposerModelBindingsResult {
  composerTraitSelection: ReturnType<typeof getComposerTraitSelection>;
  onProviderModelSelect: (provider: ProviderKind, model: ModelSlug) => void;
  providerTraitsPicker: ReactNode;
  toggleFastMode: () => void;
}

// Consolidates model/trait composer controls so ChatView can wire the footer without owning provider-specific mutations.
export function useChatComposerModelBindings(
  options: UseChatComposerModelBindingsOptions,
): UseChatComposerModelBindingsResult {
  const {
    activeThread,
    composerModelOptions,
    customModelsByProvider,
    lockedProvider,
    prompt,
    promptRef,
    scheduleComposerFocus,
    selectedModel,
    selectedProvider,
    setComposerCursor,
    setComposerDraftModelSelection,
    setComposerDraftProviderModelOptions,
    setComposerTrigger,
    setPrompt,
    setStickyComposerModelSelection,
    threadId,
  } = options;

  const setPromptFromTraits = useCallback(
    (nextPrompt: string) => {
      const currentPrompt = promptRef.current;
      if (nextPrompt === currentPrompt) {
        scheduleComposerFocus();
        return;
      }
      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      const nextCursor = collapseExpandedComposerCursor(nextPrompt, nextPrompt.length);
      setComposerCursor(nextCursor);
      setComposerTrigger(detectComposerTrigger(nextPrompt, nextPrompt.length));
      scheduleComposerFocus();
    },
    [promptRef, scheduleComposerFocus, setComposerCursor, setComposerTrigger, setPrompt],
  );

  const onProviderModelSelect = useCallback(
    (provider: ProviderKind, model: ModelSlug) => {
      if (!activeThread) return;
      if (lockedProvider !== null && provider !== lockedProvider) {
        scheduleComposerFocus();
        return;
      }
      const resolvedModel = resolveAppModelSelection(provider, customModelsByProvider, model);
      const nextModelSelection: ModelSelection = {
        provider,
        model: resolvedModel,
      };
      setComposerDraftModelSelection(activeThread.id, nextModelSelection);
      setStickyComposerModelSelection(nextModelSelection);
      scheduleComposerFocus();
    },
    [
      activeThread,
      customModelsByProvider,
      lockedProvider,
      scheduleComposerFocus,
      setComposerDraftModelSelection,
      setStickyComposerModelSelection,
    ],
  );

  const selectedProviderModelOptions = composerModelOptions?.[selectedProvider];
  const composerTraitSelection = getComposerTraitSelection(
    selectedProvider,
    selectedModel,
    prompt,
    selectedProviderModelOptions,
  );
  const providerTraitsPicker = renderProviderTraitsPicker({
    provider: selectedProvider,
    threadId,
    model: selectedModel,
    modelOptions: selectedProviderModelOptions,
    prompt,
    includeFastMode: false,
    onPromptChange: setPromptFromTraits,
  });

  const toggleFastMode = useCallback(() => {
    if (!composerTraitSelection.caps.supportsFastMode) {
      scheduleComposerFocus();
      return;
    }
    setComposerDraftProviderModelOptions(
      threadId,
      selectedProvider,
      buildNextProviderOptions(selectedProvider, selectedProviderModelOptions, {
        fastMode: !composerTraitSelection.fastModeEnabled,
      }),
      { persistSticky: true },
    );
    scheduleComposerFocus();
  }, [
    composerTraitSelection.caps.supportsFastMode,
    composerTraitSelection.fastModeEnabled,
    scheduleComposerFocus,
    selectedProvider,
    selectedProviderModelOptions,
    setComposerDraftProviderModelOptions,
    threadId,
  ]);

  return {
    composerTraitSelection,
    onProviderModelSelect,
    providerTraitsPicker,
    toggleFastMode,
  };
}
