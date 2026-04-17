import { describe, expect, it } from "vitest";

import {
  isResponse,
  isServerNotification,
  isServerRequest,
  readProviderConversationId,
  readRouteFields,
  readThreadIdFromResponse,
} from "./protocolParsing";

describe("protocolParsing", () => {
  it("classifies JSON-RPC requests, notifications, and responses", () => {
    expect(isServerRequest({ id: 1, method: "thread/read", params: {} })).toBe(true);
    expect(isServerRequest({ method: "thread/read" })).toBe(false);

    expect(isServerNotification({ method: "thread/started", params: {} })).toBe(true);
    expect(isServerNotification({ id: 1, method: "thread/started" })).toBe(false);

    expect(isResponse({ id: 1, result: {} })).toBe(true);
    expect(isResponse({ id: 1, method: "thread/read" })).toBe(false);
  });

  it("reads route ids from nested params payloads", () => {
    const route = readRouteFields({
      turn: { id: "turn-123" },
      item: { id: "item-456" },
    });

    expect(route).toEqual({
      turnId: "turn-123",
      itemId: "item-456",
    });
  });

  it("prefers thread ids before conversation ids when reading provider conversation ids", () => {
    expect(
      readProviderConversationId({
        threadId: "thread-direct",
        conversationId: "thread-fallback",
      }),
    ).toBe("thread-direct");

    expect(
      readProviderConversationId({
        thread: { id: "thread-nested" },
        conversationId: "thread-fallback",
      }),
    ).toBe("thread-nested");

    expect(readProviderConversationId({ conversationId: "thread-fallback" })).toBe(
      "thread-fallback",
    );
  });

  it("reads thread ids from both nested and flat responses", () => {
    expect(readThreadIdFromResponse("thread/read", { thread: { id: "thread-nested" } })).toBe(
      "thread-nested",
    );
    expect(readThreadIdFromResponse("thread/read", { threadId: "thread-flat" })).toBe(
      "thread-flat",
    );
  });

  it("throws when a response does not contain a thread id", () => {
    expect(() => readThreadIdFromResponse("thread/read", { ok: true })).toThrow(
      "thread/read response did not include a thread id.",
    );
  });
});
