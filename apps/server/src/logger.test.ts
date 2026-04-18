import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "./logger.ts";

const FIXED_TIME = new Date("2024-01-02T03:04:05.678Z");
const originalNoColor = process.env.NO_COLOR;
const originalIsTTY = process.stdout.isTTY;

function setStdoutTty(value: boolean) {
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value,
  });
}

describe("createLogger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME);
    delete process.env.NO_COLOR;
    setStdoutTty(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalNoColor;
    }
    setStdoutTty(Boolean(originalIsTTY));
  });

  it("logs info messages without color when stdout is not a tty", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    createLogger("server").info("started", {
      pid: 42,
      skipped: undefined,
      details: { ok: true },
    });

    expect(logSpy).toHaveBeenCalledWith(
      "03:04:05.678 INFO [server] started pid=42 details={ ok: true }",
    );
  });

  it("routes warnings and errors to the matching console methods", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const logger = createLogger("server");
    logger.warn("warned", { reason: "slow" });
    logger.error("failed", { retryable: false });

    expect(warnSpy).toHaveBeenCalledWith('03:04:05.678 WARN [server] warned reason="slow"');
    expect(errorSpy).toHaveBeenCalledWith("03:04:05.678 ERROR [server] failed retryable=false");
  });

  it("adds ansi colors when stdout is a tty and NO_COLOR is unset", () => {
    setStdoutTty(true);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    createLogger("server").event("heartbeat");

    expect(logSpy).toHaveBeenCalledWith(
      "\u001b[2m03:04:05.678\u001b[0m \u001b[35mEVENT\u001b[0m [server] heartbeat",
    );
  });

  it("disables ansi colors when NO_COLOR is set", () => {
    setStdoutTty(true);
    process.env.NO_COLOR = "1";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    createLogger("server").info("plain");

    expect(logSpy).toHaveBeenCalledWith("03:04:05.678 INFO [server] plain");
  });
});
