// FILE: useChatComposerProviderStateBindings.ts
// Purpose: Own ChatView's provider/model selection and searchable model derived state.
// Layer: ChatView hook
// Depends on: app settings, active thread/project model defaults, and composer provider presentation.

import { type ModelSelection, type ProviderKind } from "@t3tools/contracts";
import { normalizeModelSlug } from "@t3tools/shared/model";
import { useMemo } from "react";

import {
  type AppSettings,
  getCustomModelOptionsByProvider,
  getCustomModelsByProvider,
  getProviderStartOptions,
} from "../../appSettings";
import { useEffectiveComposerModelState } from "../../composerDraftStore";
import type { Thread } from "../../types";
import { AVAILABLE_PROVIDER_OPTIONS } from "./ProviderModelPicker";
import { getComposerProviderState } from "./composerProviderRegistry";

export type SearchableModelOption = {
  provider: ProviderKind;
  providerLabel: string;
  slug: string;
  name: string;
  searchSlug: string;
  searchName: string;
  searchProvider: string;
};

interface UseChatComposerProviderStateBindingsOptions {
  activeProjectDefaultModelSelection: Thread["modelSelection"] | null | undefined;
  activeThread: Thread | undefined;
  composerDraftActiveProvider: ProviderKind | null;
  prompt: string;
  settings: AppSettings;
  threadId: Thread["id"];
}

interface UseChatComposerProviderStateBindingsResult {
  composerModelOptions: ReturnType<typeof useEffectiveComposerModelState>["modelOptions"];
  composerProviderState: ReturnType<typeof getComposerProviderState>;
  customModelsByProvider: ReturnType<typeof getCustomModelsByProvider>;
  lockedProvider: ProviderKind | null;
  modelOptionsByProvider: ReturnType<typeof getCustomModelOptionsByProvider>;
  providerOptionsForDispatch: ReturnType<typeof getProviderStartOptions>;
  searchableModelOptions: ReadonlyArray<SearchableModelOption>;
  selectedModel: ReturnType<typeof useEffectiveComposerModelState>["selectedModel"];
  selectedModelForPickerWithCustomFallback: ReturnType<
    typeof useEffectiveComposerModelState
  >["selectedModel"];
  selectedModelSelection: ModelSelection;
  selectedPromptEffort: ReturnType<typeof getComposerProviderState>["promptEffort"];
  selectedProvider: ProviderKind;
}

export function useChatComposerProviderStateBindings(
  options: UseChatComposerProviderStateBindingsOptions,
): UseChatComposerProviderStateBindingsResult {
  const {
    activeProjectDefaultModelSelection,
    activeThread,
    composerDraftActiveProvider,
    prompt,
    settings,
    threadId,
  } = options;

  const sessionProvider = activeThread?.session?.provider ?? null;
  const threadProvider =
    activeThread?.modelSelection.provider ?? activeProjectDefaultModelSelection?.provider ?? null;
  const hasThreadStarted = Boolean(
    activeThread &&
    (activeThread.latestTurn !== null ||
      activeThread.messages.length > 0 ||
      activeThread.session !== null),
  );
  const lockedProvider: ProviderKind | null = hasThreadStarted
    ? (sessionProvider ?? threadProvider ?? composerDraftActiveProvider ?? null)
    : null;
  const selectedProvider: ProviderKind =
    lockedProvider ?? composerDraftActiveProvider ?? threadProvider ?? settings.defaultProvider;

  const customModelsByProvider = useMemo(() => getCustomModelsByProvider(settings), [settings]);
  const { modelOptions: composerModelOptions, selectedModel } = useEffectiveComposerModelState({
    threadId,
    selectedProvider,
    threadModelSelection: activeThread?.modelSelection,
    projectModelSelection: activeProjectDefaultModelSelection ?? undefined,
    customModelsByProvider,
  });

  const composerProviderState = useMemo(
    () =>
      getComposerProviderState({
        provider: selectedProvider,
        model: selectedModel,
        prompt,
        modelOptions: composerModelOptions,
      }),
    [composerModelOptions, prompt, selectedModel, selectedProvider],
  );

  const selectedModelOptionsForDispatch = composerProviderState.modelOptionsForDispatch;
  const selectedModelSelection = useMemo<ModelSelection>(
    () => ({
      provider: selectedProvider,
      model: selectedModel,
      ...(selectedModelOptionsForDispatch ? { options: selectedModelOptionsForDispatch } : {}),
    }),
    [selectedModel, selectedModelOptionsForDispatch, selectedProvider],
  );

  const providerOptionsForDispatch = useMemo(() => getProviderStartOptions(settings), [settings]);
  const modelOptionsByProvider = useMemo(
    () => getCustomModelOptionsByProvider(settings),
    [settings],
  );
  const selectedModelForPickerWithCustomFallback = useMemo(() => {
    const currentOptions = modelOptionsByProvider[selectedProvider];
    return currentOptions.some((option) => option.slug === selectedModel)
      ? selectedModel
      : (normalizeModelSlug(selectedModel, selectedProvider) ?? selectedModel);
  }, [modelOptionsByProvider, selectedModel, selectedProvider]);

  const searchableModelOptions = useMemo(
    () =>
      AVAILABLE_PROVIDER_OPTIONS.filter(
        (option) => lockedProvider === null || option.value === lockedProvider,
      ).flatMap((option) =>
        modelOptionsByProvider[option.value].map(({ slug, name }) => ({
          provider: option.value,
          providerLabel: option.label,
          slug,
          name,
          searchSlug: slug.toLowerCase(),
          searchName: name.toLowerCase(),
          searchProvider: option.label.toLowerCase(),
        })),
      ),
    [lockedProvider, modelOptionsByProvider],
  );

  return {
    composerModelOptions,
    composerProviderState,
    customModelsByProvider,
    lockedProvider,
    modelOptionsByProvider,
    providerOptionsForDispatch,
    searchableModelOptions,
    selectedModel,
    selectedModelForPickerWithCustomFallback,
    selectedModelSelection,
    selectedPromptEffort: composerProviderState.promptEffort,
    selectedProvider,
  };
}
