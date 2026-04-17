import { beforeEach, describe, expect, it, vi } from "vitest";

const { getVersionMock, handleMock, removeHandlerMock } = vi.hoisted(() => ({
  getVersionMock: vi.fn(() => "1.0.0"),
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getVersion: getVersionMock,
    isPackaged: false,
  },
  ipcMain: {
    removeHandler: removeHandlerMock,
    handle: handleMock,
  },
  net: {
    request: vi.fn(),
  },
}));

import {
  registerDesktopVoiceTranscriptionHandler,
  SERVER_TRANSCRIBE_VOICE_CHANNEL,
} from "./voiceTranscription";

describe("registerDesktopVoiceTranscriptionHandler", () => {
  beforeEach(() => {
    getVersionMock.mockClear();
    handleMock.mockReset();
    removeHandlerMock.mockReset();
  });

  it("registers a validated desktop voice IPC handler", () => {
    registerDesktopVoiceTranscriptionHandler();

    expect(removeHandlerMock).toHaveBeenCalledWith(SERVER_TRANSCRIBE_VOICE_CHANNEL);
    expect(handleMock).toHaveBeenCalledWith(SERVER_TRANSCRIBE_VOICE_CHANNEL, expect.any(Function));
  });

  it("rejects excess fields before desktop transcription logic runs in development", async () => {
    registerDesktopVoiceTranscriptionHandler();

    const registered = handleMock.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;

    await expect(
      registered?.(
        {},
        {
          provider: "codex",
          cwd: "/tmp/workspace",
          mimeType: "audio/wav",
          sampleRateHz: 24_000,
          durationMs: 1_000,
          audioBase64: "UklGRigAAABXQVZF",
          unexpected: "field",
        },
      ),
    ).rejects.toThrow(/Unexpected key/);
    expect(getVersionMock).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads before desktop transcription logic runs", async () => {
    registerDesktopVoiceTranscriptionHandler();

    const registered = handleMock.mock.calls[0]?.[1] as
      | ((event: unknown, payload: unknown) => unknown)
      | undefined;

    await expect(
      registered?.({}, { provider: "codex", cwd: "/tmp/workspace", sampleRateHz: 24_000 }),
    ).rejects.toThrow();
    expect(getVersionMock).not.toHaveBeenCalled();
  });
});
