import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatExpandedImageDialog } from "./ChatExpandedImageDialog";

describe("ChatExpandedImageDialog", () => {
  it("renders nothing when no expanded image is active", () => {
    expect(
      renderToStaticMarkup(
        <ChatExpandedImageDialog expandedImage={null} onClose={() => {}} onNavigate={() => {}} />,
      ),
    ).toBe("");
  });

  it("renders image navigation controls and the current index for multi-image previews", () => {
    const markup = renderToStaticMarkup(
      <ChatExpandedImageDialog
        expandedImage={{
          images: [
            { src: "blob:first", name: "First.png" },
            { src: "blob:second", name: "Second.png" },
          ],
          index: 1,
        }}
        onClose={() => {}}
        onNavigate={() => {}}
      />,
    );

    expect(markup).toContain('aria-label="Expanded image preview"');
    expect(markup).toContain('aria-label="Previous image"');
    expect(markup).toContain('aria-label="Next image"');
    expect(markup).toContain("Second.png (2/2)");
    expect(markup).toContain('src="blob:second"');
  });
});
