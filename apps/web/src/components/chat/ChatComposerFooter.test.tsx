import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatComposerFooter } from "./ChatComposerFooter";

describe("ChatComposerFooter", () => {
  it("renders the standard footer row", () => {
    const markup = renderToStaticMarkup(
      <ChatComposerFooter
        activePendingApprovalActions={null}
        isComposerFooterCompact
        leftContent={<span>left</span>}
        rightContent={<span>right</span>}
      />,
    );

    expect(markup).toContain('data-chat-composer-footer="true"');
    expect(markup).toContain("gap-1.5");
    expect(markup).toContain("left");
    expect(markup).toContain("right");
  });

  it("renders approval actions in the approval layout", () => {
    const markup = renderToStaticMarkup(
      <ChatComposerFooter
        activePendingApprovalActions={<span>approve</span>}
        isComposerFooterCompact={false}
        leftContent={<span>left</span>}
        rightContent={<span>right</span>}
      />,
    );

    expect(markup).toContain("justify-end");
    expect(markup).toContain("approve");
    expect(markup).not.toContain("data-chat-composer-footer");
  });
});
