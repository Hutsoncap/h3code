import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ChatEmptyThreadState } from "./ChatEmptyThreadState";

vi.mock("../ui/sidebar", () => ({
  SidebarHeaderTrigger: ({ className }: { className?: string }) => (
    <div data-testid="sidebar-header-trigger" className={className} />
  ),
}));

describe("ChatEmptyThreadState", () => {
  it("keeps the no-active-thread prompt and sidebar trigger in browser mode", () => {
    const markup = renderToStaticMarkup(<ChatEmptyThreadState sidebarSide="left" />);

    expect(markup).toContain("Select a thread or create a new one to get started.");
    expect(markup).toContain("Threads");
    expect(markup).toContain("size-7 shrink-0");
    expect(markup).not.toContain("No active thread");
  });
});
