// FILE: useChatComposerMenuBindings.ts
// Purpose: Own ChatView's remaining composer discovery and menu derived state.
// Layer: ChatView hook
// Depends on: composer trigger state, provider discovery results, and slash-command affordances.

import type {
  ProjectEntry,
  ProviderKind,
  ProviderMentionReference,
  ProviderNativeCommandDescriptor,
  ProviderModelOptions,
  ProviderPluginDescriptor,
  ProviderSkillDescriptor,
} from "@t3tools/contracts";
import { getModelCapabilities } from "@t3tools/shared/model";
import { useMemo } from "react";

import { useComposerCommandMenuItems } from "../../hooks/useComposerCommandMenuItems";
import {
  canOfferForkSlashCommand,
  canOfferReviewSlashCommand,
  hasProviderNativeSlashCommand,
  resolveComposerSlashRootBranch,
} from "../../composerSlashCommands";
import { stripComposerTriggerText, type ComposerTrigger } from "../../composer-logic";
import type { Thread } from "../../types";
import type { ComposerCommandItem } from "./ComposerCommandMenu";
import type { SearchableModelOption } from "./useChatComposerProviderStateBindings";

type BranchList = Parameters<typeof resolveComposerSlashRootBranch>[0]["branches"];
type ComposerCommandPicker = "fork-target" | "review-target" | null;

type ComposerPluginSuggestion = {
  plugin: ProviderPluginDescriptor;
  mention: ProviderMentionReference;
};

const EMPTY_COMPOSER_PLUGIN_SUGGESTIONS: ComposerPluginSuggestion[] = [];

interface UseChatComposerMenuBindingsOptions {
  activeProjectCwd: string | undefined;
  activeThread: Thread | undefined;
  branches: BranchList;
  branchesIsRepo: boolean | undefined;
  composerCommandPicker: ComposerCommandPicker;
  composerHighlightedItemId: string | null;
  composerImagesCount: number;
  composerModelOptions: ProviderModelOptions | null | undefined;
  composerTerminalContextsCount: number;
  composerTrigger: ComposerTrigger | null;
  interactionMode: Thread["interactionMode"];
  isServerThread: boolean;
  providerNativeCommands: ReadonlyArray<ProviderNativeCommandDescriptor>;
  providerPluginMarketplaces:
    | ReadonlyArray<{
        name: string;
        plugins: ReadonlyArray<ProviderPluginDescriptor>;
      }>
    | undefined;
  providerSkills: ReadonlyArray<ProviderSkillDescriptor>;
  prompt: string;
  searchableModelOptions: ReadonlyArray<SearchableModelOption>;
  selectedComposerMentionsCount: number;
  selectedComposerSkillsCount: number;
  selectedModel: string;
  selectedProvider: ProviderKind;
  workspaceEntries: ReadonlyArray<ProjectEntry>;
}

interface UseChatComposerMenuBindingsResult {
  activeComposerMenuItem: ComposerCommandItem | null;
  activeRootBranch: ReturnType<typeof resolveComposerSlashRootBranch>;
  composerMenuItems: ComposerCommandItem[];
  composerMenuOpen: boolean;
  currentProviderModelOptions: ProviderModelOptions[ProviderKind] | undefined;
  effectiveComposerTrigger: ComposerTrigger | null;
  effectiveComposerTriggerKind: ComposerTrigger["kind"] | null;
  fastModeEnabled: boolean;
  providerPlugins: ReadonlyArray<ComposerPluginSuggestion>;
  supportsFastSlashCommand: boolean;
  supportsTextNativeReviewCommand: boolean;
}

export function useChatComposerMenuBindings(
  options: UseChatComposerMenuBindingsOptions,
): UseChatComposerMenuBindingsResult {
  const {
    activeProjectCwd,
    activeThread,
    branches,
    branchesIsRepo,
    composerCommandPicker,
    composerHighlightedItemId,
    composerImagesCount,
    composerModelOptions,
    composerTerminalContextsCount,
    composerTrigger,
    interactionMode,
    isServerThread,
    providerNativeCommands,
    providerPluginMarketplaces,
    providerSkills,
    prompt,
    searchableModelOptions,
    selectedComposerMentionsCount,
    selectedComposerSkillsCount,
    selectedModel,
    selectedProvider,
    workspaceEntries,
  } = options;

  const activeRootBranch = useMemo(
    () =>
      resolveComposerSlashRootBranch({
        branches,
        activeProjectCwd,
        activeThreadBranch: activeThread?.branch,
      }),
    [activeProjectCwd, activeThread?.branch, branches],
  );

  const providerPlugins = useMemo(
    () =>
      providerPluginMarketplaces?.flatMap((marketplace) =>
        marketplace.plugins.map((plugin) => ({
          plugin,
          mention: {
            name: plugin.name,
            path: `plugin://${plugin.name}@${marketplace.name}`,
          } satisfies ProviderMentionReference,
        })),
      ) ?? EMPTY_COMPOSER_PLUGIN_SUGGESTIONS,
    [providerPluginMarketplaces],
  );

  const providerNativeCommandNames = useMemo(
    () => providerNativeCommands.map((command) => command.name),
    [providerNativeCommands],
  );
  const effectiveComposerTrigger = useMemo(() => {
    if (
      composerTrigger?.kind === "slash-model" &&
      hasProviderNativeSlashCommand(selectedProvider, providerNativeCommandNames, "model")
    ) {
      return {
        ...composerTrigger,
        kind: "slash-command" as const,
        query: "model",
      };
    }
    return composerTrigger;
  }, [composerTrigger, providerNativeCommandNames, selectedProvider]);
  const effectiveComposerTriggerKind = effectiveComposerTrigger?.kind ?? null;

  const supportsTextNativeReviewCommand = useMemo(
    () => providerNativeCommands.some((command) => command.name.toLowerCase() === "review"),
    [providerNativeCommands],
  );

  const selectedModelCaps = useMemo(
    () => getModelCapabilities(selectedProvider, selectedModel),
    [selectedModel, selectedProvider],
  );
  const supportsFastSlashCommand = selectedModelCaps.supportsFastMode;
  const currentProviderModelOptions = composerModelOptions?.[selectedProvider];
  const fastModeEnabled =
    supportsFastSlashCommand &&
    (currentProviderModelOptions as { fastMode?: boolean } | undefined)?.fastMode === true;

  const composerPromptWithoutActiveSlashTrigger =
    composerTrigger?.kind === "slash-command"
      ? stripComposerTriggerText(prompt, composerTrigger)
      : prompt;
  const canOfferReviewCommand =
    (branchesIsRepo ?? true) &&
    canOfferReviewSlashCommand({
      prompt: composerPromptWithoutActiveSlashTrigger,
      imageCount: composerImagesCount,
      terminalContextCount: composerTerminalContextsCount,
      selectedSkillCount: selectedComposerSkillsCount,
      selectedMentionCount: selectedComposerMentionsCount,
    });
  const canOfferForkCommand =
    isServerThread &&
    activeThread !== undefined &&
    canOfferForkSlashCommand({
      prompt: composerPromptWithoutActiveSlashTrigger,
      imageCount: composerImagesCount,
      terminalContextCount: composerTerminalContextsCount,
      selectedSkillCount: selectedComposerSkillsCount,
      selectedMentionCount: selectedComposerMentionsCount,
      interactionMode,
    });

  const normalComposerMenuItems = useComposerCommandMenuItems({
    composerTrigger: effectiveComposerTrigger,
    provider: selectedProvider,
    providerPlugins,
    providerNativeCommands,
    providerSkills,
    workspaceEntries,
    searchableModelOptions,
    supportsFastSlashCommand,
    canOfferReviewCommand,
    canOfferForkCommand,
  });

  const composerMenuItems = useMemo(() => {
    if (composerCommandPicker === "fork-target") {
      return [
        {
          id: "fork-target:worktree",
          type: "fork-target" as const,
          target: "worktree" as const,
          label: "Fork Into New Worktree",
          description: "Continue in a new worktree",
        },
        {
          id: "fork-target:local",
          type: "fork-target" as const,
          target: "local" as const,
          label: "Fork Into Local",
          description:
            activeThread?.worktreePath || activeThread?.envMode === "worktree"
              ? "Continue in this local worktree"
              : "Continue in the current local thread",
        },
      ];
    }
    if (composerCommandPicker === "review-target") {
      return [
        {
          id: "review-target:changes",
          type: "review-target" as const,
          target: "changes" as const,
          label: "Review Uncommitted Changes",
          description: "Review local uncommitted changes",
        },
        {
          id: "review-target:base-branch",
          type: "review-target" as const,
          target: "base-branch" as const,
          label: "Review Against Base Branch",
          description: "Review the current branch diff against its base",
        },
      ];
    }

    return normalComposerMenuItems;
  }, [
    activeThread?.envMode,
    activeThread?.worktreePath,
    composerCommandPicker,
    normalComposerMenuItems,
  ]);

  const composerMenuOpen = Boolean(composerTrigger || composerCommandPicker);
  const activeComposerMenuItem = useMemo(
    () =>
      composerMenuItems.find((item) => item.id === composerHighlightedItemId) ??
      composerMenuItems[0] ??
      null,
    [composerHighlightedItemId, composerMenuItems],
  );

  return {
    activeComposerMenuItem,
    activeRootBranch,
    composerMenuItems,
    composerMenuOpen,
    currentProviderModelOptions,
    effectiveComposerTrigger,
    effectiveComposerTriggerKind,
    fastModeEnabled,
    providerPlugins,
    supportsFastSlashCommand,
    supportsTextNativeReviewCommand,
  };
}
