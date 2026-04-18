// FILE: useChatComposerDiscoveryBindings.ts
// Purpose: Own ChatView's composer discovery queries, menu loading state, and prompt-sync effects.
// Layer: ChatView hook
// Depends on: provider discovery queries, workspace search, and composer menu state setters.

import type {
  ProjectEntry,
  ProviderKind,
  ProviderMentionReference,
  ProviderModelOptions,
  ProviderNativeCommandDescriptor,
  ProviderPluginDescriptor,
  ProviderSkillDescriptor,
  ProviderSkillReference,
  ThreadId,
} from "@t3tools/contracts";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { type Dispatch, type SetStateAction, useEffect, useMemo } from "react";

import { type ComposerTrigger } from "../../composer-logic";
import { projectSearchEntriesQueryOptions } from "~/lib/projectReactQuery";
import { resolveProviderDiscoveryCwd } from "~/lib/providerDiscovery";
import {
  providerComposerCapabilitiesQueryOptions,
  providerCommandsQueryOptions,
  providerPluginsQueryOptions,
  providerSkillsQueryOptions,
  supportsNativeSlashCommandDiscovery,
  supportsPluginDiscovery,
  supportsSkillDiscovery,
} from "~/lib/providerDiscoveryReactQuery";
import { gitBranchesQueryOptions } from "~/lib/gitReactQuery";
import type { Thread } from "../../types";
import type { SearchableModelOption } from "./useChatComposerProviderStateBindings";
import { useChatComposerMenuBindings } from "./useChatComposerMenuBindings";

const COMPOSER_PATH_QUERY_DEBOUNCE_MS = 120;
const EMPTY_PROJECT_ENTRIES: ProjectEntry[] = [];
const EMPTY_PROVIDER_NATIVE_COMMANDS: ProviderNativeCommandDescriptor[] = [];
const EMPTY_PROVIDER_SKILLS: ProviderSkillDescriptor[] = [];

type ComposerCommandPicker = "fork-target" | "review-target" | null;
type ComposerPluginSuggestion = {
  plugin: ProviderPluginDescriptor;
  mention: ProviderMentionReference;
};

const providerMentionReferencesEqual = (
  left: ReadonlyArray<ProviderMentionReference>,
  right: ReadonlyArray<ProviderMentionReference>,
): boolean =>
  left.length === right.length &&
  left.every(
    (mention, index) => mention.path === right[index]?.path && mention.name === right[index]?.name,
  );

interface UseChatComposerDiscoveryBindingsOptions {
  activeProjectCwd: string | undefined;
  activeThread: Thread | undefined;
  composerCommandPicker: ComposerCommandPicker;
  composerHighlightedItemId: string | null;
  composerImagesCount: number;
  composerModelOptions: ProviderModelOptions | null | undefined;
  composerTerminalContextsCount: number;
  composerTrigger: ComposerTrigger | null;
  gitBranchSourceCwd: string | null;
  gitCwd: string | null;
  interactionMode: Thread["interactionMode"];
  isServerThread: boolean;
  prompt: string;
  resolvedThreadWorktreePath: string | null;
  searchableModelOptions: ReadonlyArray<SearchableModelOption>;
  selectedComposerMentions: ReadonlyArray<ProviderMentionReference>;
  selectedComposerSkills: ReadonlyArray<ProviderSkillReference>;
  selectedModel: string;
  selectedProvider: ProviderKind;
  serverCwd: string | null;
  threadId: ThreadId;
  setComposerCommandPicker: Dispatch<SetStateAction<ComposerCommandPicker>>;
  setComposerHighlightedItemId: Dispatch<SetStateAction<string | null>>;
  setComposerTrigger: Dispatch<SetStateAction<ComposerTrigger | null>>;
  setSelectedComposerMentions: Dispatch<SetStateAction<ProviderMentionReference[]>>;
  setSelectedComposerSkills: Dispatch<SetStateAction<ProviderSkillReference[]>>;
  promptIncludesSkillMention: (prompt: string, skillName: string, provider: string) => boolean;
  resolvePromptPluginMentions: (params: {
    prompt: string;
    existingMentions: ReadonlyArray<ProviderMentionReference>;
    providerPlugins: ReadonlyArray<ComposerPluginSuggestion>;
  }) => ProviderMentionReference[];
}

interface UseChatComposerDiscoveryBindingsResult {
  activeComposerMenuItem: ReturnType<typeof useChatComposerMenuBindings>["activeComposerMenuItem"];
  activeRootBranch: ReturnType<typeof useChatComposerMenuBindings>["activeRootBranch"];
  branchesIsRepo: boolean | undefined;
  composerMenuItems: ReturnType<typeof useChatComposerMenuBindings>["composerMenuItems"];
  composerMenuOpen: boolean;
  composerSkillCwd: string | null;
  currentProviderModelOptions: ReturnType<
    typeof useChatComposerMenuBindings
  >["currentProviderModelOptions"];
  effectiveComposerTriggerKind: ReturnType<
    typeof useChatComposerMenuBindings
  >["effectiveComposerTriggerKind"];
  fastModeEnabled: boolean;
  isComposerMenuLoading: boolean;
  providerNativeCommands: ReadonlyArray<ProviderNativeCommandDescriptor>;
  providerPlugins: ReadonlyArray<ComposerPluginSuggestion>;
  providerSkills: ReadonlyArray<ProviderSkillDescriptor>;
  supportsFastSlashCommand: boolean;
  supportsTextNativeReviewCommand: boolean;
}

export function useChatComposerDiscoveryBindings(
  options: UseChatComposerDiscoveryBindingsOptions,
): UseChatComposerDiscoveryBindingsResult {
  const {
    activeProjectCwd,
    activeThread,
    composerCommandPicker,
    composerHighlightedItemId,
    composerImagesCount,
    composerModelOptions,
    composerTerminalContextsCount,
    composerTrigger,
    gitBranchSourceCwd,
    gitCwd,
    interactionMode,
    isServerThread,
    prompt,
    resolvedThreadWorktreePath,
    searchableModelOptions,
    selectedComposerMentions,
    selectedComposerSkills,
    selectedModel,
    selectedProvider,
    serverCwd,
    threadId,
    setComposerCommandPicker,
    setComposerHighlightedItemId,
    setComposerTrigger,
    setSelectedComposerMentions,
    setSelectedComposerSkills,
    promptIncludesSkillMention,
    resolvePromptPluginMentions,
  } = options;

  const composerTriggerKind = composerTrigger?.kind ?? null;
  const mentionTriggerQuery = composerTrigger?.kind === "mention" ? composerTrigger.query : "";
  const isMentionTrigger = composerTriggerKind === "mention";
  const skillTriggerQuery = composerTrigger?.kind === "skill" ? composerTrigger.query : "";
  const isSkillTrigger = composerTriggerKind === "skill";
  const [debouncedPathQuery, composerPathQueryDebouncer] = useDebouncedValue(
    mentionTriggerQuery,
    { wait: COMPOSER_PATH_QUERY_DEBOUNCE_MS },
    (debouncerState) => ({ isPending: debouncerState.isPending }),
  );
  const effectiveMentionQuery = mentionTriggerQuery.length > 0 ? debouncedPathQuery : "";

  const branchesQuery = useQuery(gitBranchesQueryOptions(gitBranchSourceCwd));
  const composerSkillCwd = resolveProviderDiscoveryCwd({
    activeThreadWorktreePath: resolvedThreadWorktreePath,
    activeProjectCwd: activeProjectCwd ?? null,
    serverCwd,
  });
  const providerComposerCapabilitiesQuery = useQuery(
    providerComposerCapabilitiesQueryOptions(selectedProvider),
  );
  const providerCommandsQuery = useQuery(
    providerCommandsQueryOptions({
      provider: selectedProvider,
      cwd: composerSkillCwd,
      threadId,
      query:
        composerTriggerKind === "slash-command" || composerTriggerKind === "slash-model"
          ? (composerTrigger?.query ?? "")
          : "",
      enabled:
        (composerTriggerKind === "slash-command" || composerTriggerKind === "slash-model") &&
        supportsNativeSlashCommandDiscovery(providerComposerCapabilitiesQuery.data) &&
        composerSkillCwd !== null,
    }),
  );
  const providerSkillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: selectedProvider,
      cwd: composerSkillCwd,
      threadId,
      query: skillTriggerQuery,
      enabled:
        isSkillTrigger &&
        supportsSkillDiscovery(providerComposerCapabilitiesQuery.data) &&
        composerSkillCwd !== null,
    }),
  );
  const providerPluginsQuery = useQuery(
    providerPluginsQueryOptions({
      provider: selectedProvider,
      cwd: composerSkillCwd,
      threadId,
      enabled:
        supportsPluginDiscovery(providerComposerCapabilitiesQuery.data) &&
        composerSkillCwd !== null,
    }),
  );
  const workspaceEntriesQuery = useQuery(
    projectSearchEntriesQueryOptions({
      cwd: gitCwd,
      query: effectiveMentionQuery,
      enabled: isMentionTrigger,
      limit: 80,
    }),
  );
  const workspaceEntries = workspaceEntriesQuery.data?.entries ?? EMPTY_PROJECT_ENTRIES;
  const providerNativeCommands =
    providerCommandsQuery.data?.commands ?? EMPTY_PROVIDER_NATIVE_COMMANDS;
  const providerSkills = providerSkillsQuery.data?.skills ?? EMPTY_PROVIDER_SKILLS;

  const {
    activeComposerMenuItem,
    activeRootBranch,
    composerMenuItems,
    composerMenuOpen,
    currentProviderModelOptions,
    effectiveComposerTriggerKind,
    fastModeEnabled,
    providerPlugins,
    supportsFastSlashCommand,
    supportsTextNativeReviewCommand,
  } = useChatComposerMenuBindings({
    activeProjectCwd,
    activeThread,
    branches: branchesQuery.data?.branches,
    branchesIsRepo: branchesQuery.data?.isRepo,
    composerCommandPicker,
    composerHighlightedItemId,
    composerImagesCount,
    composerModelOptions,
    composerTerminalContextsCount,
    composerTrigger,
    interactionMode,
    isServerThread,
    providerNativeCommands,
    providerPluginMarketplaces: providerPluginsQuery.data?.marketplaces,
    providerSkills,
    prompt,
    searchableModelOptions,
    selectedComposerMentionsCount: selectedComposerMentions.length,
    selectedComposerSkillsCount: selectedComposerSkills.length,
    selectedModel,
    selectedProvider,
    workspaceEntries,
  });

  useEffect(() => {
    if (!composerMenuOpen) {
      setComposerHighlightedItemId(null);
      return;
    }
    setComposerHighlightedItemId((existing) =>
      existing && composerMenuItems.some((item) => item.id === existing)
        ? existing
        : (composerMenuItems[0]?.id ?? null),
    );
  }, [composerMenuItems, composerMenuOpen, setComposerHighlightedItemId]);

  useEffect(() => {
    setSelectedComposerSkills((existing) =>
      existing.filter((skill) => promptIncludesSkillMention(prompt, skill.name, selectedProvider)),
    );
  }, [prompt, promptIncludesSkillMention, selectedProvider, setSelectedComposerSkills]);

  useEffect(() => {
    setSelectedComposerMentions((existing) => {
      const nextMentions = resolvePromptPluginMentions({
        prompt,
        existingMentions: existing,
        providerPlugins,
      });
      return providerMentionReferencesEqual(existing, nextMentions) ? existing : nextMentions;
    });
  }, [prompt, providerPlugins, resolvePromptPluginMentions, setSelectedComposerMentions]);

  useEffect(() => {
    setSelectedComposerSkills([]);
    setSelectedComposerMentions([]);
  }, [selectedProvider, setSelectedComposerMentions, setSelectedComposerSkills]);

  useEffect(() => {
    if (!composerMenuOpen) {
      return;
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setComposerCommandPicker(null);
      setComposerHighlightedItemId(null);
      setComposerTrigger(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    composerMenuOpen,
    setComposerCommandPicker,
    setComposerHighlightedItemId,
    setComposerTrigger,
  ]);

  const isComposerMenuLoading = useMemo(
    () =>
      (composerTriggerKind === "mention" &&
        ((mentionTriggerQuery.length > 0 && composerPathQueryDebouncer.state.isPending) ||
          workspaceEntriesQuery.isLoading ||
          workspaceEntriesQuery.isFetching ||
          providerPluginsQuery.isLoading ||
          providerPluginsQuery.isFetching)) ||
      (composerTriggerKind === "slash-command" &&
        (providerCommandsQuery.isLoading || providerCommandsQuery.isFetching)),
    [
      composerPathQueryDebouncer.state.isPending,
      composerTriggerKind,
      mentionTriggerQuery.length,
      providerCommandsQuery.isFetching,
      providerCommandsQuery.isLoading,
      providerPluginsQuery.isFetching,
      providerPluginsQuery.isLoading,
      workspaceEntriesQuery.isFetching,
      workspaceEntriesQuery.isLoading,
    ],
  );

  return {
    activeComposerMenuItem,
    activeRootBranch,
    branchesIsRepo: branchesQuery.data?.isRepo,
    composerMenuItems,
    composerMenuOpen,
    composerSkillCwd,
    currentProviderModelOptions,
    effectiveComposerTriggerKind,
    fastModeEnabled,
    isComposerMenuLoading,
    providerNativeCommands,
    providerPlugins,
    providerSkills,
    supportsFastSlashCommand,
    supportsTextNativeReviewCommand,
  };
}
