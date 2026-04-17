import { memo } from "react";

import { type ApprovalRequestId } from "@t3tools/contracts";

import type { PendingApproval, PendingUserInput } from "../../session-logic";
import type { PendingUserInputDraftAnswer } from "../../pendingUserInput";
import { ComposerPendingApprovalPanel } from "./ComposerPendingApprovalPanel";
import { ComposerPendingUserInputPanel } from "./ComposerPendingUserInputPanel";
import { ComposerPlanFollowUpBanner } from "./ComposerPlanFollowUpBanner";

interface ChatComposerStatusBannerProps {
  activePendingApproval: PendingApproval | null;
  pendingApprovalsCount: number;
  pendingUserInputs: PendingUserInput[];
  respondingRequestIds: ApprovalRequestId[];
  activePendingDraftAnswers: Record<string, PendingUserInputDraftAnswer>;
  activePendingQuestionIndex: number;
  onToggleActivePendingUserInputOption: (questionId: string, optionLabel: string) => void;
  onAdvanceActivePendingUserInput: () => void;
  showPlanFollowUpPrompt: boolean;
  planTitle: string | null;
}

export const ChatComposerStatusBanner = memo(function ChatComposerStatusBanner({
  activePendingApproval,
  pendingApprovalsCount,
  pendingUserInputs,
  respondingRequestIds,
  activePendingDraftAnswers,
  activePendingQuestionIndex,
  onToggleActivePendingUserInputOption,
  onAdvanceActivePendingUserInput,
  showPlanFollowUpPrompt,
  planTitle,
}: ChatComposerStatusBannerProps) {
  if (activePendingApproval) {
    return (
      <ComposerPendingApprovalPanel
        approval={activePendingApproval}
        pendingCount={pendingApprovalsCount}
      />
    );
  }

  if (pendingUserInputs.length > 0) {
    return (
      <ComposerPendingUserInputPanel
        pendingUserInputs={pendingUserInputs}
        respondingRequestIds={respondingRequestIds}
        answers={activePendingDraftAnswers}
        questionIndex={activePendingQuestionIndex}
        onToggleOption={onToggleActivePendingUserInputOption}
        onAdvance={onAdvanceActivePendingUserInput}
      />
    );
  }

  if (showPlanFollowUpPrompt) {
    return <ComposerPlanFollowUpBanner planTitle={planTitle} />;
  }

  return null;
});
