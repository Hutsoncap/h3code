// FILE: useChatTranscriptBindings.ts
// Purpose: Own ChatView's transcript and navigation callback wiring.
// Layer: ChatView hook
// Depends on: router navigation, transcript UI state setters, and checkpoint/script handlers.

import { type MessageId, type ProjectScript, type ThreadId, type TurnId } from "@t3tools/contracts";
import { type useNavigate } from "@tanstack/react-router";
import { useCallback, type Dispatch, type SetStateAction } from "react";

import { stripDiffSearchParams } from "../../diffRouteSearch";
import { type ExpandedImagePreview } from "./ExpandedImagePreview";

interface UseChatTranscriptBindingsOptions {
  diffEnvironmentPending: boolean;
  forceStickToBottom: (behavior?: ScrollBehavior) => void;
  navigate: ReturnType<typeof useNavigate>;
  onOpenTurnDiffPanel?: ((turnId: TurnId, filePath?: string) => void) | undefined;
  onRevertToTurnCount: (turnCount: number) => void | Promise<void>;
  revertTurnCountByUserMessageId: ReadonlyMap<MessageId, number>;
  runProjectScript: (script: ProjectScript) => void | Promise<void>;
  setExpandedImage: Dispatch<SetStateAction<ExpandedImagePreview | null>>;
  setExpandedWorkGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  threadId: ThreadId;
}

interface UseChatTranscriptBindingsResult {
  onExpandTimelineImage: (preview: ExpandedImagePreview) => void;
  onNavigateToThread: (nextThreadId: ThreadId) => void;
  onOpenTurnDiff: (turnId: TurnId, filePath?: string) => void;
  onRevertUserMessage: (messageId: MessageId) => void;
  onRunProjectScriptFromHeader: (script: ProjectScript) => void;
  onScrollToBottom: () => void;
  onToggleWorkGroup: (groupId: string) => void;
}

export function useChatTranscriptBindings(
  options: UseChatTranscriptBindingsOptions,
): UseChatTranscriptBindingsResult {
  const {
    diffEnvironmentPending,
    forceStickToBottom,
    navigate,
    onOpenTurnDiffPanel,
    onRevertToTurnCount,
    revertTurnCountByUserMessageId,
    runProjectScript,
    setExpandedImage,
    setExpandedWorkGroups,
    threadId,
  } = options;

  const onToggleWorkGroup = useCallback(
    (groupId: string) => {
      setExpandedWorkGroups((existing) => ({
        ...existing,
        [groupId]: !existing[groupId],
      }));
    },
    [setExpandedWorkGroups],
  );

  const onExpandTimelineImage = useCallback(
    (preview: ExpandedImagePreview) => {
      setExpandedImage(preview);
    },
    [setExpandedImage],
  );

  const onScrollToBottom = useCallback(() => {
    forceStickToBottom("smooth");
  }, [forceStickToBottom]);

  const onOpenTurnDiff = useCallback(
    (turnId: TurnId, filePath?: string) => {
      if (diffEnvironmentPending) {
        return;
      }
      if (onOpenTurnDiffPanel) {
        onOpenTurnDiffPanel(turnId, filePath);
        return;
      }
      void navigate({
        to: "/$threadId",
        params: { threadId },
        search: (previous) => {
          const rest = stripDiffSearchParams(previous);
          return filePath
            ? { ...rest, panel: "diff", diff: "1", diffTurnId: turnId, diffFilePath: filePath }
            : { ...rest, panel: "diff", diff: "1", diffTurnId: turnId };
        },
      });
    },
    [diffEnvironmentPending, navigate, onOpenTurnDiffPanel, threadId],
  );

  const onNavigateToThread = useCallback(
    (nextThreadId: ThreadId) => {
      void navigate({
        to: "/$threadId",
        params: { threadId: nextThreadId },
        search: (previous) => stripDiffSearchParams(previous),
      });
    },
    [navigate],
  );

  const onRevertUserMessage = useCallback(
    (messageId: MessageId) => {
      const targetTurnCount = revertTurnCountByUserMessageId.get(messageId);
      if (typeof targetTurnCount !== "number") {
        return;
      }
      void onRevertToTurnCount(targetTurnCount);
    },
    [onRevertToTurnCount, revertTurnCountByUserMessageId],
  );

  const onRunProjectScriptFromHeader = useCallback(
    (script: ProjectScript) => {
      void runProjectScript(script);
    },
    [runProjectScript],
  );

  return {
    onExpandTimelineImage,
    onNavigateToThread,
    onOpenTurnDiff,
    onRevertUserMessage,
    onRunProjectScriptFromHeader,
    onScrollToBottom,
    onToggleWorkGroup,
  };
}
