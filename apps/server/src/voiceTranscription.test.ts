import { Buffer } from "node:buffer";

import type { ServerVoiceTranscriptionInput } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vitest";

import { transcribeVoiceWithChatGptSession } from "./voiceTranscription.ts";

const VALID_WAV_BASE64 = Buffer.from("RIFF0000WAVE").toString("base64");

function createRequest(
  overrides: Partial<ServerVoiceTranscriptionInput> = {},
): ServerVoiceTranscriptionInput {
  return {
    provider: "codex",
    cwd: "/workspace",
    mimeType: "audio/wav",
    sampleRateHz: 24_000,
    durationMs: 1_000,
    audioBase64: VALID_WAV_BASE64,
    ...overrides,
  };
}

describe("transcribeVoiceWithChatGptSession", () => {
  it("rejects malformed base64 payloads before reaching fetch", async () => {
    const resolveAuth = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      transcribeVoiceWithChatGptSession({
        request: createRequest({ audioBase64: "%%%not-base64%%%" }),
        resolveAuth,
        fetchImpl,
      }),
    ).rejects.toThrow("The recorded audio could not be decoded.");

    expect(resolveAuth).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects non-WAV payloads before reaching fetch", async () => {
    const resolveAuth = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      transcribeVoiceWithChatGptSession({
        request: createRequest({
          audioBase64: Buffer.from("not-a-wave-file").toString("base64"),
        }),
        resolveAuth,
        fetchImpl,
      }),
    ).rejects.toThrow("The recorded audio is not a valid WAV file.");

    expect(resolveAuth).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refreshes auth once after an expired session and retries the request", async () => {
    const resolveAuth = vi
      .fn<(refreshToken: boolean) => Promise<{ token: string; transcriptionUrl?: string }>>()
      .mockResolvedValueOnce({
        token: "expired-token",
        transcriptionUrl: "https://chatgpt.invalid/first",
      })
      .mockResolvedValueOnce({
        token: "fresh-token",
        transcriptionUrl: "https://chatgpt.invalid/second",
      });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "nope" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ transcript: " refreshed transcript " }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await expect(
      transcribeVoiceWithChatGptSession({
        request: createRequest(),
        resolveAuth,
        fetchImpl,
      }),
    ).resolves.toEqual({ text: "refreshed transcript" });

    expect(resolveAuth).toHaveBeenNthCalledWith(1, false);
    expect(resolveAuth).toHaveBeenNthCalledWith(2, true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://chatgpt.invalid/first",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer expired-token",
        }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://chatgpt.invalid/second",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-token",
        }),
      }),
    );
  });

  it("returns the provider error message for non-auth failures", async () => {
    const resolveAuth = vi.fn().mockResolvedValue({ token: "token" });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: " upstream failed " } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      transcribeVoiceWithChatGptSession({
        request: createRequest(),
        resolveAuth,
        fetchImpl,
      }),
    ).rejects.toThrow("upstream failed");
  });

  it("falls back to a generic status message when the provider body is invalid", async () => {
    const resolveAuth = vi.fn().mockResolvedValue({ token: "token" });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("not-json", { status: 502 }));

    await expect(
      transcribeVoiceWithChatGptSession({
        request: createRequest(),
        resolveAuth,
        fetchImpl,
      }),
    ).rejects.toThrow("Transcription failed with status 502.");
  });

  it("surfaces the sign-in prompt when refreshed auth still returns 403", async () => {
    const resolveAuth = vi
      .fn<(refreshToken: boolean) => Promise<{ token: string }>>()
      .mockResolvedValueOnce({ token: "expired-token" })
      .mockResolvedValueOnce({ token: "still-expired-token" });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("forbidden", { status: 403 }))
      .mockResolvedValueOnce(new Response("still-forbidden", { status: 403 }));

    await expect(
      transcribeVoiceWithChatGptSession({
        request: createRequest(),
        resolveAuth,
        fetchImpl,
      }),
    ).rejects.toThrow("Your ChatGPT login has expired. Sign in again.");

    expect(resolveAuth).toHaveBeenNthCalledWith(1, false);
    expect(resolveAuth).toHaveBeenNthCalledWith(2, true);
  });
});
