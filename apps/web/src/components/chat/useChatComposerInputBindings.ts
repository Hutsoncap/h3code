// FILE: useChatComposerInputBindings.ts
// Purpose: Own ChatView's prompt-editing, focus, and draft restore/reset composer callbacks.
// Layer: ChatView hook
// Depends on: prompt editor refs, composer draft helpers, and pending-input draft updates.

import {
  type ProviderMentionReference,
  type ProviderSkillReference,
  type ThreadId,
} from "@t3tools/contracts";
import { useCallback, type Dispatch, type RefObject, type SetStateAction } from "react";

import { type ComposerImageAttachment } from "../../composerDraftStore";
import {
  collapseExpandedComposerCursor,
  detectComposerTrigger,
  expandCollapsedComposerCursor,
  replaceTextRange,
} from "../../composer-logic";
import { type TerminalContextDraft } from "../../lib/terminalContext";
import { type ComposerPromptEditorHandle } from "../ComposerPromptEditor";
import { appendVoiceTranscriptToPrompt } from "../ChatView.logic";

interface RestoreFailedComposerSendDraftInput {
  images: ComposerImageAttachment[];
  mentions: ProviderMentionReference[];
  prompt: string;
  skills: ProviderSkillReference[];
  terminalContexts: TerminalContextDraft[];
}

interface UseChatComposerInputBindingsOptions {
  activePendingQuestionId: string | null;
  addComposerImagesToDraft: (images: ComposerImageAttachment[]) => void;
  addComposerTerminalContextsToDraft: (terminalContexts: TerminalContextDraft[]) => void;
  clearComposerDraftContent: (threadId: ThreadId) => void;
  composerEditorRef: RefObject<ComposerPromptEditorHandle | null>;
  promptRef: RefObject<string>;
  setActivePendingUserInputCustomAnswerValue: (questionId: string, value: string) => void;
  setComposerCursor: Dispatch<SetStateAction<number>>;
  setComposerHighlightedItemId: Dispatch<SetStateAction<string | null>>;
  setComposerTrigger: Dispatch<SetStateAction<ReturnType<typeof detectComposerTrigger>>>;
  setPrompt: (prompt: string) => void;
  setSelectedComposerMentions: Dispatch<SetStateAction<ProviderMentionReference[]>>;
  setSelectedComposerSkills: Dispatch<SetStateAction<ProviderSkillReference[]>>;
}

interface UseChatComposerInputBindingsResult {
  appendVoiceTranscriptToComposer: (transcript: string) => void;
  applyPromptReplacement: (
    rangeStart: number,
    rangeEnd: number,
    replacement: string,
    options?: { cursorOffset?: number; expectedText?: string },
  ) => number | false;
  clearComposerInput: (threadId: ThreadId) => void;
  focusComposer: () => void;
  restoreFailedComposerSendDraft: (input: RestoreFailedComposerSendDraftInput) => void;
  scheduleComposerFocus: () => void;
}

export function useChatComposerInputBindings(
  options: UseChatComposerInputBindingsOptions,
): UseChatComposerInputBindingsResult {
  const {
    activePendingQuestionId,
    addComposerImagesToDraft,
    addComposerTerminalContextsToDraft,
    clearComposerDraftContent,
    composerEditorRef,
    promptRef,
    setActivePendingUserInputCustomAnswerValue,
    setComposerCursor,
    setComposerHighlightedItemId,
    setComposerTrigger,
    setPrompt,
    setSelectedComposerMentions,
    setSelectedComposerSkills,
  } = options;

  const focusComposer = useCallback(() => {
    composerEditorRef.current?.focusAtEnd();
  }, [composerEditorRef]);

  const scheduleComposerFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      focusComposer();
    });
  }, [focusComposer]);

  const appendVoiceTranscriptToComposer = useCallback(
    (transcript: string) => {
      const nextPrompt = appendVoiceTranscriptToPrompt(promptRef.current, transcript);
      if (!nextPrompt) {
        return;
      }

      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      setComposerCursor(collapseExpandedComposerCursor(nextPrompt, nextPrompt.length));
      setComposerTrigger(detectComposerTrigger(nextPrompt, nextPrompt.length));
      scheduleComposerFocus();
    },
    [promptRef, scheduleComposerFocus, setComposerCursor, setComposerTrigger, setPrompt],
  );

  const clearComposerInput = useCallback(
    (threadId: ThreadId) => {
      promptRef.current = "";
      clearComposerDraftContent(threadId);
      setSelectedComposerSkills([]);
      setSelectedComposerMentions([]);
      setComposerHighlightedItemId(null);
      setComposerCursor(0);
      setComposerTrigger(null);
    },
    [
      clearComposerDraftContent,
      promptRef,
      setComposerCursor,
      setComposerHighlightedItemId,
      setComposerTrigger,
      setSelectedComposerMentions,
      setSelectedComposerSkills,
    ],
  );

  const restoreFailedComposerSendDraft = useCallback(
    ({
      prompt,
      images,
      terminalContexts,
      skills,
      mentions,
    }: RestoreFailedComposerSendDraftInput) => {
      promptRef.current = prompt;
      setPrompt(prompt);
      setComposerCursor(collapseExpandedComposerCursor(prompt, prompt.length));
      if (images.length > 0) {
        addComposerImagesToDraft(images);
      }
      if (terminalContexts.length > 0) {
        addComposerTerminalContextsToDraft(terminalContexts);
      }
      setSelectedComposerSkills(skills);
      setSelectedComposerMentions(mentions);
      setComposerTrigger(detectComposerTrigger(prompt, prompt.length));
    },
    [
      addComposerImagesToDraft,
      addComposerTerminalContextsToDraft,
      promptRef,
      setComposerCursor,
      setComposerTrigger,
      setPrompt,
      setSelectedComposerMentions,
      setSelectedComposerSkills,
    ],
  );

  const applyPromptReplacement = useCallback(
    (
      rangeStart: number,
      rangeEnd: number,
      replacement: string,
      options?: { cursorOffset?: number; expectedText?: string },
    ): number | false => {
      const currentText = promptRef.current;
      const safeStart = Math.max(0, Math.min(currentText.length, rangeStart));
      const safeEnd = Math.max(safeStart, Math.min(currentText.length, rangeEnd));
      if (
        options?.expectedText !== undefined &&
        currentText.slice(safeStart, safeEnd) !== options.expectedText
      ) {
        return false;
      }

      const next = replaceTextRange(promptRef.current, rangeStart, rangeEnd, replacement);
      let nextCursor = collapseExpandedComposerCursor(next.text, next.cursor);
      if (options?.cursorOffset !== undefined) {
        nextCursor = Math.max(0, nextCursor + options.cursorOffset);
      }

      promptRef.current = next.text;
      if (activePendingQuestionId) {
        setActivePendingUserInputCustomAnswerValue(activePendingQuestionId, next.text);
      } else {
        setPrompt(next.text);
      }
      setComposerCursor(nextCursor);
      setComposerTrigger(
        detectComposerTrigger(next.text, expandCollapsedComposerCursor(next.text, nextCursor)),
      );
      window.requestAnimationFrame(() => {
        composerEditorRef.current?.focusAt(nextCursor);
      });
      return nextCursor;
    },
    [
      activePendingQuestionId,
      composerEditorRef,
      promptRef,
      setActivePendingUserInputCustomAnswerValue,
      setComposerCursor,
      setComposerTrigger,
      setPrompt,
    ],
  );

  return {
    appendVoiceTranscriptToComposer,
    applyPromptReplacement,
    clearComposerInput,
    focusComposer,
    restoreFailedComposerSendDraft,
    scheduleComposerFocus,
  };
}
