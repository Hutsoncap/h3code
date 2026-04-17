import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { type PullRequestDialogState } from "../ChatView.logic";

const { pullRequestThreadDialogMock } = vi.hoisted(() => ({
  pullRequestThreadDialogMock: vi.fn(
    ({
      open,
      cwd,
      initialReference,
    }: {
      open: boolean;
      cwd: string | null;
      initialReference: string | null;
    }) => (
      <div data-open={String(open)} data-cwd={cwd ?? ""} data-reference={initialReference ?? ""} />
    ),
  ),
}));

vi.mock("../PullRequestThreadDialog", () => ({
  PullRequestThreadDialog: pullRequestThreadDialogMock,
}));

import { ChatPullRequestDialog } from "./ChatPullRequestDialog";

describe("ChatPullRequestDialog", () => {
  it("renders nothing when there is no dialog state", () => {
    const markup = renderToStaticMarkup(
      <ChatPullRequestDialog
        dialogState={null}
        cwd="/tmp/repo"
        onClose={vi.fn()}
        onPrepared={vi.fn()}
      />,
    );

    expect(markup).toBe("");
  });

  it("forwards the pull request dialog state to the shared dialog component", () => {
    const onClose = vi.fn();
    const onPrepared = vi.fn();
    const dialogState = {
      key: 1,
      initialReference: "#42",
    } satisfies PullRequestDialogState;

    const markup = renderToStaticMarkup(
      <ChatPullRequestDialog
        dialogState={dialogState}
        cwd="/tmp/repo"
        onClose={onClose}
        onPrepared={onPrepared}
      />,
    );

    expect(markup).toContain('data-open="true"');
    expect(markup).toContain('data-cwd="/tmp/repo"');
    expect(markup).toContain('data-reference="#42"');
    expect(pullRequestThreadDialogMock).toHaveBeenCalledTimes(1);
  });
});
