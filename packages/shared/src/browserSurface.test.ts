import { describe, expect, it } from "vitest";

import {
  browserSurfaceKey,
  createStandaloneBrowserSurfaceId,
  createThreadBrowserSurfaceId,
  createWebAppBrowserSurfaceId,
  sameBrowserSurfaceId,
} from "./browserSurface";

describe("browserSurface helpers", () => {
  it("builds canonical keys for all supported surface kinds", () => {
    expect(browserSurfaceKey(createThreadBrowserSurfaceId("thread-1" as never))).toBe(
      "thread:thread-1",
    );
    expect(browserSurfaceKey(createStandaloneBrowserSurfaceId("main"))).toBe("standalone:main");
    expect(browserSurfaceKey(createWebAppBrowserSurfaceId("webapp-1"))).toBe("webapp:webapp-1");
  });

  it("compares browser surface ids by their canonical keys", () => {
    expect(
      sameBrowserSurfaceId(
        createStandaloneBrowserSurfaceId("main"),
        createStandaloneBrowserSurfaceId("main"),
      ),
    ).toBe(true);
    expect(
      sameBrowserSurfaceId(
        createStandaloneBrowserSurfaceId("main"),
        createStandaloneBrowserSurfaceId("secondary"),
      ),
    ).toBe(false);
  });
});
