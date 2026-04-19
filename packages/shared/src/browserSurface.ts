import type { BrowserSurfaceId, ThreadId } from "@t3tools/contracts";

export type BrowserSurfaceKey = string;

export function createThreadBrowserSurfaceId(threadId: ThreadId): BrowserSurfaceId {
  return {
    kind: "thread",
    threadId,
  };
}

export function createStandaloneBrowserSurfaceId(id: string): BrowserSurfaceId {
  return {
    kind: "standalone",
    id,
  };
}

export function createWebAppBrowserSurfaceId(webAppId: string): BrowserSurfaceId {
  return {
    kind: "webapp",
    webAppId,
  };
}

export function resolveBrowserSurfaceId(input: {
  surfaceId?: BrowserSurfaceId | null | undefined;
  threadId?: ThreadId | null | undefined;
}): BrowserSurfaceId | null {
  if (input.surfaceId) {
    return input.surfaceId;
  }

  if (input.threadId) {
    return createThreadBrowserSurfaceId(input.threadId);
  }

  return null;
}

export function browserSurfaceKey(surfaceId: BrowserSurfaceId): BrowserSurfaceKey {
  switch (surfaceId.kind) {
    case "thread":
      return `thread:${surfaceId.threadId}`;
    case "standalone":
      return `standalone:${surfaceId.id}`;
    case "webapp":
      return `webapp:${surfaceId.webAppId}`;
  }

  throw new Error(
    `Unsupported browser surface kind: ${String((surfaceId as { kind?: unknown }).kind)}`,
  );
}

export function sameBrowserSurfaceId(
  left: BrowserSurfaceId | null | undefined,
  right: BrowserSurfaceId | null | undefined,
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return browserSurfaceKey(left) === browserSurfaceKey(right);
}
