import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { type ApprovalRequestId } from "@t3tools/contracts";

import { type PendingApproval, type PendingUserInput } from "../../session-logic";
import { ChatComposerStatusBanner } from "./ChatComposerStatusBanner";

describe("ChatComposerStatusBanner", () => {
  it("renders the pending approval banner when approval is active", () => {
    const markup = renderToStaticMarkup(
      <ChatComposerStatusBanner
        activePendingApproval={
          {
            requestId: "approval-1" as ApprovalRequestId,
            requestKind: "command",
            createdAt: "2026-01-01T00:00:00.000Z",
          } satisfies PendingApproval
        }
        pendingApprovalsCount={2}
        pendingUserInputs={[]}
        respondingRequestIds={[]}
        activePendingDraftAnswers={{}}
        activePendingQuestionIndex={0}
        onToggleActivePendingUserInputOption={vi.fn()}
        onAdvanceActivePendingUserInput={vi.fn()}
        showPlanFollowUpPrompt={false}
        planTitle={null}
      />,
    );

    expect(markup).toContain("PENDING APPROVAL");
    expect(markup).toContain("Command approval requested");
    expect(markup).toContain("1/2");
  });

  it("renders the pending user input banner when questions are pending", () => {
    const markup = renderToStaticMarkup(
      <ChatComposerStatusBanner
        activePendingApproval={null}
        pendingApprovalsCount={0}
        pendingUserInputs={
          [
            {
              requestId: "approval-2" as ApprovalRequestId,
              createdAt: "2026-01-01T00:00:00.000Z",
              questions: [
                {
                  id: "q1",
                  header: "Choose",
                  question: "Pick one",
                  multiSelect: true,
                  options: [
                    { label: "A", description: "Option A" },
                    { label: "B", description: "Option B" },
                  ],
                },
              ],
            },
          ] satisfies PendingUserInput[]
        }
        respondingRequestIds={[]}
        activePendingDraftAnswers={{}}
        activePendingQuestionIndex={0}
        onToggleActivePendingUserInputOption={vi.fn()}
        onAdvanceActivePendingUserInput={vi.fn()}
        showPlanFollowUpPrompt={false}
        planTitle={null}
      />,
    );

    expect(markup).toContain("Choose");
    expect(markup).toContain("Pick one");
    expect(markup).toContain("Select one or more options.");
  });

  it("renders the plan follow-up banner when a plan is ready", () => {
    const markup = renderToStaticMarkup(
      <ChatComposerStatusBanner
        activePendingApproval={null}
        pendingApprovalsCount={0}
        pendingUserInputs={[]}
        respondingRequestIds={[]}
        activePendingDraftAnswers={{}}
        activePendingQuestionIndex={0}
        onToggleActivePendingUserInputOption={vi.fn()}
        onAdvanceActivePendingUserInput={vi.fn()}
        showPlanFollowUpPrompt
        planTitle="Refine extraction"
      />,
    );

    expect(markup).toContain("Plan ready");
    expect(markup).toContain("Refine extraction");
  });
});
