// FILE: useChatComposerCommandBindings.ts
// Purpose: Own ChatView's composer command-menu, slash-command, and prompt-edit bindings.
// Layer: ChatView hook
// Depends on: composer draft setters, slash-command hook, and caller-owned prompt/send helpers.

import {
  type ModelSelection,
  type ModelSlug,
  type OrchestrationReadModel,
  type ProviderInteractionMode,
  type ProviderKind,
  type ProviderMentionReference,
  type ProviderModelOptions,
  type ProviderNativeCommandDescriptor,
  type ProviderSkillReference,
  type RuntimeMode,
  type ThreadId,
} from "@t3tools/contracts";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
} from "react";

import {
  type ComposerTrigger,
  collapseExpandedComposerCursor,
  detectComposerTrigger,
  expandCollapsedComposerCursor,
} from "../../composer-logic";
import { useComposerSlashCommands } from "../../hooks/useComposerSlashCommands";
import { type TerminalContextDraft } from "../../lib/terminalContext";
import type { Project, Thread } from "../../types";
import { type ComposerPromptEditorHandle } from "../ComposerPromptEditor";
import { type ComposerCommandItem } from "./ComposerCommandMenu";

type ComposerCommandPicker = null | "fork-target" | "review-target";

interface UseChatComposerCommandBindingsOptions {
  activePendingQuestionId: string | null;
  activeProject: Project | undefined;
  activeRootBranch: string | null;
  activeThread: Thread | undefined;
  applyPromptReplacement: (
    rangeStart: number,
    rangeEnd: number,
    replacement: string,
    options?: { expectedText?: string; cursorOffset?: number },
  ) => number | false;
  buildSkillMentionReplacement: (skillName: string) => string;
  clearComposerDraftContent: (threadId: ThreadId) => void;
  composerCommandPicker: ComposerCommandPicker;
  composerCursor: number;
  composerEditorRef: MutableRefObject<ComposerPromptEditorHandle | null>;
  composerHighlightedItemId: string | null;
  composerMenuItems: ReadonlyArray<ComposerCommandItem>;
  composerMenuOpen: boolean;
  composerTerminalContexts: ReadonlyArray<TerminalContextDraft>;
  currentProviderModelOptions: ProviderModelOptions[ProviderKind] | undefined;
  fastModeEnabled: boolean;
  handleInteractionModeChange: (mode: "default" | "plan") => Promise<void> | void;
  hasActivePendingUserInput: boolean;
  interactionMode: ProviderInteractionMode;
  isServerThread: boolean;
  navigateToThread: (threadId: ThreadId) => Promise<void>;
  onChangeActivePendingUserInputCustomAnswer: (
    questionId: string,
    value: string,
    nextCursor: number,
    expandedCursor: number,
    cursorAdjacentToMention: boolean,
  ) => void;
  onProviderModelSelect: (provider: ProviderKind, model: ModelSlug) => void;
  onSend: (
    e?: { preventDefault: () => void },
    dispatchMode?: "queue" | "steer",
  ) => Promise<boolean>;
  openFreshThread: () => Promise<void> | void;
  providerCommandDiscoveryCwd: string | null;
  providerNativeCommands: readonly ProviderNativeCommandDescriptor[];
  promptRef: MutableRefObject<string>;
  runtimeMode: RuntimeMode;
  scheduleComposerFocus: () => void;
  selectedModelSelection: ModelSelection;
  selectedProvider: ProviderKind;
  setComposerCommandPicker: (picker: ComposerCommandPicker) => void;
  setComposerCursor: (cursor: number) => void;
  setComposerDraftProviderModelOptions: (
    threadId: ThreadId,
    provider: ProviderKind,
    nextProviderOptions: ProviderModelOptions[ProviderKind],
    options?: { persistSticky?: boolean },
  ) => void;
  setComposerDraftTerminalContexts: (threadId: ThreadId, contexts: TerminalContextDraft[]) => void;
  setComposerHighlightedItemId: (id: string | null) => void;
  setComposerTrigger: (trigger: ComposerTrigger | null) => void;
  setPrompt: (prompt: string) => void;
  setSelectedComposerMentions: Dispatch<SetStateAction<ProviderMentionReference[]>>;
  setSelectedComposerSkills: Dispatch<SetStateAction<ProviderSkillReference[]>>;
  supportsFastSlashCommand: boolean;
  supportsTextNativeReviewCommand: boolean;
  syncServerReadModel: (snapshot: OrchestrationReadModel) => void;
  threadId: ThreadId;
  toggleInteractionMode: () => void;
}

interface UseChatComposerCommandBindingsResult {
  handleStandaloneSlashCommand: (text: string) => Promise<boolean>;
  isSlashStatusDialogOpen: boolean;
  onComposerCommandKey: (
    key: "ArrowDown" | "ArrowUp" | "Enter" | "Tab",
    event: KeyboardEvent,
  ) => boolean;
  onComposerMenuItemHighlighted: (itemId: string | null) => void;
  onPromptChange: (
    nextPrompt: string,
    nextCursor: number,
    expandedCursor: number,
    cursorAdjacentToMention: boolean,
    terminalContextIds: string[],
  ) => void;
  onSelectComposerItem: (item: ComposerCommandItem) => void;
  setIsSlashStatusDialogOpen: (open: boolean) => void;
}

const extendReplacementRangeForTrailingSpace = (
  text: string,
  rangeEnd: number,
  replacement: string,
): number => {
  if (!replacement.endsWith(" ")) {
    return rangeEnd;
  }
  return text[rangeEnd] === " " ? rangeEnd + 1 : rangeEnd;
};

const syncTerminalContextsByIds = (
  contexts: ReadonlyArray<TerminalContextDraft>,
  ids: ReadonlyArray<string>,
): TerminalContextDraft[] => {
  const contextsById = new Map(contexts.map((context) => [context.id, context]));
  return ids.flatMap((id) => {
    const context = contextsById.get(id);
    return context ? [context] : [];
  });
};

const terminalContextIdListsEqual = (
  contexts: ReadonlyArray<TerminalContextDraft>,
  ids: ReadonlyArray<string>,
): boolean =>
  contexts.length === ids.length && contexts.every((context, index) => context.id === ids[index]);

// Keeps the slash-command/menu editor flow together so ChatView only renders the composer surface.
export function useChatComposerCommandBindings(
  options: UseChatComposerCommandBindingsOptions,
): UseChatComposerCommandBindingsResult {
  const {
    activePendingQuestionId,
    activeProject,
    activeRootBranch,
    activeThread,
    applyPromptReplacement,
    buildSkillMentionReplacement,
    clearComposerDraftContent,
    composerCommandPicker,
    composerCursor,
    composerEditorRef,
    composerHighlightedItemId,
    composerMenuItems,
    composerMenuOpen,
    composerTerminalContexts,
    currentProviderModelOptions,
    fastModeEnabled,
    handleInteractionModeChange,
    hasActivePendingUserInput,
    interactionMode,
    isServerThread,
    navigateToThread,
    onChangeActivePendingUserInputCustomAnswer,
    onProviderModelSelect,
    onSend,
    openFreshThread,
    providerCommandDiscoveryCwd,
    providerNativeCommands,
    promptRef,
    runtimeMode,
    scheduleComposerFocus,
    selectedModelSelection,
    selectedProvider,
    setComposerCommandPicker,
    setComposerCursor,
    setComposerDraftProviderModelOptions,
    setComposerDraftTerminalContexts,
    setComposerHighlightedItemId,
    setComposerTrigger,
    setPrompt,
    setSelectedComposerMentions,
    setSelectedComposerSkills,
    supportsFastSlashCommand,
    supportsTextNativeReviewCommand,
    syncServerReadModel,
    threadId,
    toggleInteractionMode,
  } = options;

  const composerSelectLockRef = useRef(false);

  const readComposerSnapshot = useCallback((): {
    value: string;
    cursor: number;
    expandedCursor: number;
    terminalContextIds: string[];
  } => {
    const editorSnapshot = composerEditorRef.current?.readSnapshot();
    if (editorSnapshot) {
      return editorSnapshot;
    }
    return {
      value: promptRef.current,
      cursor: composerCursor,
      expandedCursor: expandCollapsedComposerCursor(promptRef.current, composerCursor),
      terminalContextIds: composerTerminalContexts.map((context) => context.id),
    };
  }, [composerCursor, composerEditorRef, composerTerminalContexts, promptRef]);

  const resolveActiveComposerTrigger = useCallback((): {
    snapshot: { value: string; cursor: number; expandedCursor: number };
    trigger: ComposerTrigger | null;
  } => {
    const snapshot = readComposerSnapshot();
    return {
      snapshot,
      trigger: detectComposerTrigger(snapshot.value, snapshot.expandedCursor),
    };
  }, [readComposerSnapshot]);

  const setComposerPromptValue = useCallback(
    (nextPrompt: string) => {
      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      const nextCursor = collapseExpandedComposerCursor(nextPrompt, nextPrompt.length);
      setComposerCursor(nextCursor);
      setComposerTrigger(detectComposerTrigger(nextPrompt, nextPrompt.length));
      setComposerHighlightedItemId(null);
      window.requestAnimationFrame(() => {
        composerEditorRef.current?.focusAt(nextCursor);
      });
    },
    [
      composerEditorRef,
      promptRef,
      setComposerCursor,
      setComposerHighlightedItemId,
      setComposerTrigger,
      setPrompt,
    ],
  );

  const clearComposerSlashDraft = useCallback(() => {
    promptRef.current = "";
    clearComposerDraftContent(threadId);
    setComposerHighlightedItemId(null);
    setComposerCursor(0);
    setComposerTrigger(null);
    scheduleComposerFocus();
  }, [
    clearComposerDraftContent,
    promptRef,
    scheduleComposerFocus,
    setComposerCursor,
    setComposerHighlightedItemId,
    setComposerTrigger,
    threadId,
  ]);

  const slashEditorActions = useMemo(
    () => ({
      resolveActiveComposerTrigger,
      applyPromptReplacement,
      extendReplacementRangeForTrailingSpace,
      clearComposerSlashDraft,
      setComposerPromptValue,
      scheduleComposerFocus,
      setComposerHighlightedItemId,
    }),
    [
      applyPromptReplacement,
      clearComposerSlashDraft,
      resolveActiveComposerTrigger,
      scheduleComposerFocus,
      setComposerPromptValue,
      setComposerHighlightedItemId,
    ],
  );

  const {
    handleForkTargetSelection,
    handleReviewTargetSelection,
    isSlashStatusDialogOpen,
    setIsSlashStatusDialogOpen,
    handleStandaloneSlashCommand,
    handleSlashCommandSelection,
  } = useComposerSlashCommands({
    activeProject,
    activeThread,
    activeRootBranch,
    isServerThread,
    supportsFastSlashCommand,
    supportsTextNativeReviewCommand,
    fastModeEnabled,
    providerNativeCommands,
    providerCommandDiscoveryCwd,
    selectedProvider,
    currentProviderModelOptions,
    selectedModelSelection,
    runtimeMode,
    interactionMode,
    threadId,
    syncServerReadModel,
    navigateToThread,
    handleClearConversation: openFreshThread,
    handleInteractionModeChange,
    openForkTargetPicker: () => {
      setComposerCommandPicker("fork-target");
      setComposerHighlightedItemId("fork-target:worktree");
    },
    openReviewTargetPicker: () => {
      setComposerCommandPicker("review-target");
      setComposerHighlightedItemId("review-target:changes");
    },
    setComposerDraftProviderModelOptions,
    editorActions: slashEditorActions,
  });

  const onSelectComposerItem = useCallback(
    (item: ComposerCommandItem) => {
      if (composerSelectLockRef.current) return;
      composerSelectLockRef.current = true;
      window.requestAnimationFrame(() => {
        composerSelectLockRef.current = false;
      });
      if (item.type === "fork-target") {
        setComposerCommandPicker(null);
        setComposerHighlightedItemId(null);
        void handleForkTargetSelection(item.target);
        return;
      }
      if (item.type === "review-target") {
        setComposerCommandPicker(null);
        setComposerHighlightedItemId(null);
        void handleReviewTargetSelection(item.target);
        return;
      }
      const { snapshot, trigger } = resolveActiveComposerTrigger();
      if (!trigger) return;
      if (item.type === "path") {
        const replacement = `@${item.path} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied !== false) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "slash-command") {
        handleSlashCommandSelection(item);
        return;
      }
      if (item.type === "provider-native-command") {
        const replacement = `/${item.command} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied !== false) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "skill") {
        const replacement = buildSkillMentionReplacement(item.skill.name);
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied !== false) {
          setSelectedComposerSkills((existing) => {
            const nextSkill = {
              name: item.skill.name,
              path: item.skill.path,
            } satisfies ProviderSkillReference;
            return existing.some(
              (skill) => skill.name === nextSkill.name && skill.path === nextSkill.path,
            )
              ? existing
              : [...existing, nextSkill];
          });
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "plugin") {
        const replacement = `@${item.plugin.name} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied !== false) {
          setSelectedComposerMentions((existing) => {
            const nextMention = item.mention;
            const nextWithoutSameName = existing.filter(
              (mention) => mention.name !== nextMention.name,
            );
            return [...nextWithoutSameName, nextMention];
          });
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "model") {
        onProviderModelSelect(item.provider, item.model);
        const applied = applyPromptReplacement(trigger.rangeStart, trigger.rangeEnd, "", {
          expectedText: snapshot.value.slice(trigger.rangeStart, trigger.rangeEnd),
        });
        if (applied !== false) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "agent") {
        const replacement = `@${item.alias}()`;
        const applied = applyPromptReplacement(trigger.rangeStart, trigger.rangeEnd, replacement, {
          expectedText: snapshot.value.slice(trigger.rangeStart, trigger.rangeEnd),
          cursorOffset: -1,
        });
        if (applied !== false) {
          setComposerHighlightedItemId(null);
        }
      }
    },
    [
      applyPromptReplacement,
      buildSkillMentionReplacement,
      handleForkTargetSelection,
      handleReviewTargetSelection,
      handleSlashCommandSelection,
      onProviderModelSelect,
      resolveActiveComposerTrigger,
      setComposerCommandPicker,
      setComposerHighlightedItemId,
      setSelectedComposerMentions,
      setSelectedComposerSkills,
    ],
  );

  const onComposerMenuItemHighlighted = useCallback(
    (itemId: string | null) => {
      setComposerHighlightedItemId(itemId);
    },
    [setComposerHighlightedItemId],
  );

  const nudgeComposerMenuHighlight = useCallback(
    (key: "ArrowDown" | "ArrowUp") => {
      if (composerMenuItems.length === 0) {
        return;
      }
      const highlightedIndex = composerMenuItems.findIndex(
        (item) => item.id === composerHighlightedItemId,
      );
      const normalizedIndex =
        highlightedIndex >= 0 ? highlightedIndex : key === "ArrowDown" ? -1 : 0;
      const offset = key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (normalizedIndex + offset + composerMenuItems.length) % composerMenuItems.length;
      const nextItem = composerMenuItems[nextIndex];
      setComposerHighlightedItemId(nextItem?.id ?? null);
    },
    [composerHighlightedItemId, composerMenuItems, setComposerHighlightedItemId],
  );

  const onPromptChange = useCallback(
    (
      nextPrompt: string,
      nextCursor: number,
      expandedCursor: number,
      cursorAdjacentToMention: boolean,
      terminalContextIds: string[],
    ) => {
      if (activePendingQuestionId && hasActivePendingUserInput) {
        onChangeActivePendingUserInputCustomAnswer(
          activePendingQuestionId,
          nextPrompt,
          nextCursor,
          expandedCursor,
          cursorAdjacentToMention,
        );
        return;
      }
      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      if (composerCommandPicker !== null && nextPrompt.trim().length > 0) {
        setComposerCommandPicker(null);
      }
      if (!terminalContextIdListsEqual(composerTerminalContexts, terminalContextIds)) {
        setComposerDraftTerminalContexts(
          threadId,
          syncTerminalContextsByIds(composerTerminalContexts, terminalContextIds),
        );
      }
      setComposerCursor(nextCursor);
      setComposerTrigger(
        cursorAdjacentToMention ? null : detectComposerTrigger(nextPrompt, expandedCursor),
      );
    },
    [
      activePendingQuestionId,
      composerCommandPicker,
      composerTerminalContexts,
      hasActivePendingUserInput,
      onChangeActivePendingUserInputCustomAnswer,
      promptRef,
      setComposerCommandPicker,
      setComposerCursor,
      setComposerDraftTerminalContexts,
      setComposerTrigger,
      setPrompt,
      threadId,
    ],
  );

  const onComposerCommandKey = useCallback(
    (key: "ArrowDown" | "ArrowUp" | "Enter" | "Tab", event: KeyboardEvent) => {
      if (key === "Tab" && event.shiftKey) {
        toggleInteractionMode();
        return true;
      }

      const { trigger } = resolveActiveComposerTrigger();
      const menuIsActive = composerMenuOpen || trigger !== null;

      if (menuIsActive) {
        if (key === "ArrowDown" && composerMenuItems.length > 0) {
          nudgeComposerMenuHighlight("ArrowDown");
          return true;
        }
        if (key === "ArrowUp" && composerMenuItems.length > 0) {
          nudgeComposerMenuHighlight("ArrowUp");
          return true;
        }
        if (key === "Tab" || key === "Enter") {
          const selectedItem =
            composerMenuItems.find((item) => item.id === composerHighlightedItemId) ??
            composerMenuItems[0];
          if (selectedItem) {
            onSelectComposerItem(selectedItem);
            return true;
          }
        }
      }

      if (key === "Enter" && !event.shiftKey) {
        void onSend(undefined, event.metaKey || event.ctrlKey ? "steer" : "queue");
        return true;
      }
      return false;
    },
    [
      composerHighlightedItemId,
      composerMenuItems,
      composerMenuOpen,
      nudgeComposerMenuHighlight,
      onSelectComposerItem,
      onSend,
      resolveActiveComposerTrigger,
      toggleInteractionMode,
    ],
  );

  return {
    handleStandaloneSlashCommand,
    isSlashStatusDialogOpen,
    onComposerCommandKey,
    onComposerMenuItemHighlighted,
    onPromptChange,
    onSelectComposerItem,
    setIsSlashStatusDialogOpen,
  };
}
