// FILE: useChatComposerTerminalContextBindings.ts
// Purpose: Own ChatView's inline terminal-context placeholder insertion and removal logic.
// Layer: ChatView hook
// Depends on: composer prompt editor snapshots plus composer draft terminal-context setters.

import { type ThreadId } from "@t3tools/contracts";
import { useCallback, type MutableRefObject, type RefObject } from "react";
import {
  type ComposerTrigger,
  collapseExpandedComposerCursor,
  detectComposerTrigger,
  expandCollapsedComposerCursor,
} from "~/composer-logic";
import { type ComposerPromptEditorHandle } from "../ComposerPromptEditor";
import {
  type TerminalContextDraft,
  type TerminalContextSelection,
  insertInlineTerminalContextPlaceholder,
  removeInlineTerminalContextPlaceholder,
} from "../../lib/terminalContext";
import { randomUUID } from "../../lib/utils";

interface UseChatComposerTerminalContextBindingsOptions {
  activeThreadId: ThreadId | null;
  composerCursor: number;
  composerEditorRef: RefObject<ComposerPromptEditorHandle | null>;
  composerTerminalContexts: ReadonlyArray<TerminalContextDraft>;
  insertComposerDraftTerminalContext: (
    threadId: ThreadId,
    prompt: string,
    context: TerminalContextDraft,
    contextIndex: number,
  ) => boolean;
  promptRef: MutableRefObject<string>;
  removeComposerDraftTerminalContext: (threadId: ThreadId, contextId: string) => void;
  setComposerCursor: (cursor: number) => void;
  setComposerTrigger: (trigger: ComposerTrigger | null) => void;
  setPrompt: (nextPrompt: string) => void;
  threadId: ThreadId;
}

interface UseChatComposerTerminalContextBindingsResult {
  addTerminalContextToDraft: (selection: TerminalContextSelection) => void;
  removeComposerTerminalContextFromDraft: (contextId: string) => void;
}

export function useChatComposerTerminalContextBindings(
  options: UseChatComposerTerminalContextBindingsOptions,
): UseChatComposerTerminalContextBindingsResult {
  const {
    activeThreadId,
    composerCursor,
    composerEditorRef,
    composerTerminalContexts,
    insertComposerDraftTerminalContext,
    promptRef,
    removeComposerDraftTerminalContext,
    setComposerCursor,
    setComposerTrigger,
    setPrompt,
    threadId,
  } = options;

  const removeComposerTerminalContextFromDraft = useCallback(
    (contextId: string) => {
      const contextIndex = composerTerminalContexts.findIndex(
        (context) => context.id === contextId,
      );
      if (contextIndex < 0) {
        return;
      }
      const nextPrompt = removeInlineTerminalContextPlaceholder(promptRef.current, contextIndex);
      promptRef.current = nextPrompt.prompt;
      setPrompt(nextPrompt.prompt);
      removeComposerDraftTerminalContext(threadId, contextId);
      setComposerCursor(nextPrompt.cursor);
      setComposerTrigger(
        detectComposerTrigger(
          nextPrompt.prompt,
          expandCollapsedComposerCursor(nextPrompt.prompt, nextPrompt.cursor),
        ),
      );
    },
    [
      composerTerminalContexts,
      promptRef,
      removeComposerDraftTerminalContext,
      setComposerCursor,
      setComposerTrigger,
      setPrompt,
      threadId,
    ],
  );

  const addTerminalContextToDraft = useCallback(
    (selection: TerminalContextSelection) => {
      if (!activeThreadId) {
        return;
      }
      const snapshot = composerEditorRef.current?.readSnapshot();
      const value = snapshot?.value ?? promptRef.current;
      const expandedCursor =
        snapshot?.expandedCursor ??
        expandCollapsedComposerCursor(promptRef.current, composerCursor);
      const insertion = insertInlineTerminalContextPlaceholder(value, expandedCursor);
      const nextCollapsedCursor = collapseExpandedComposerCursor(
        insertion.prompt,
        insertion.cursor,
      );
      const inserted = insertComposerDraftTerminalContext(
        activeThreadId,
        insertion.prompt,
        {
          id: randomUUID(),
          threadId: activeThreadId,
          createdAt: new Date().toISOString(),
          ...selection,
        },
        insertion.contextIndex,
      );
      if (!inserted) {
        return;
      }
      promptRef.current = insertion.prompt;
      setComposerCursor(nextCollapsedCursor);
      setComposerTrigger(detectComposerTrigger(insertion.prompt, insertion.cursor));
      window.requestAnimationFrame(() => {
        composerEditorRef.current?.focusAt(nextCollapsedCursor);
      });
    },
    [
      activeThreadId,
      composerCursor,
      composerEditorRef,
      insertComposerDraftTerminalContext,
      promptRef,
      setComposerCursor,
      setComposerTrigger,
    ],
  );

  return {
    addTerminalContextToDraft,
    removeComposerTerminalContextFromDraft,
  };
}
