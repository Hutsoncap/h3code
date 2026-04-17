import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { TurnId } from "@t3tools/contracts";
import { ChatActivePlanCard } from "./ChatActivePlanCard";

describe("ChatActivePlanCard", () => {
  it("renders nothing when there is no active plan", () => {
    const markup = renderToStaticMarkup(
      <ChatActivePlanCard activePlan={null} backgroundTaskCount={0} onOpenSidebar={vi.fn()} />,
    );

    expect(markup).toBe("");
  });

  it("renders the active plan card inside the centered wrapper", () => {
    const markup = renderToStaticMarkup(
      <ChatActivePlanCard
        activePlan={{
          createdAt: "2025-04-17T00:00:00.000Z",
          turnId: "turn-1" as TurnId,
          steps: [
            { step: "First step", status: "completed" },
            { step: "Second step", status: "pending" },
          ],
        }}
        backgroundTaskCount={2}
        onOpenSidebar={vi.fn()}
      />,
    );

    expect(markup).toContain("mx-auto w-11/12");
    expect(markup).toContain("First step");
    expect(markup).toContain("background agents");
  });
});
