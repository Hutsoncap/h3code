import "../../index.css";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { SidebarSearchHighlight } from "./SidebarSearchHighlight";

describe("SidebarSearchHighlight", () => {
  it("renders repeated matches with separate highlight nodes", async () => {
    const screen = await render(
      <SidebarSearchHighlight query="compose" text="compose compose compose" />,
    );

    const marks = screen.container.querySelectorAll("mark");
    expect(marks).toHaveLength(3);
    expect(Array.from(marks, (mark) => mark.textContent)).toEqual([
      "compose",
      "compose",
      "compose",
    ]);
  });
});
