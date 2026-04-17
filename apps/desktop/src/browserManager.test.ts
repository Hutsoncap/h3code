import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromPartition, BrowserWindow, WebContentsView } = vi.hoisted(() => ({
  fromPartition: vi.fn(),
  BrowserWindow: function BrowserWindow() {},
  WebContentsView: function WebContentsView() {},
}));

vi.mock("electron", () => {
  return {
    BrowserWindow,
    WebContentsView,
    shell: {
      openExternal: vi.fn(),
    },
    session: {
      fromPartition,
    },
  };
});

import { migrateLegacyBrowserSessionPartition } from "./browserManager";

type CookieLike = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "unspecified" | "no_restriction" | "lax" | "strict";
  session?: boolean;
  expirationDate?: number;
};

function createSession(cookiesToRead: readonly CookieLike[]) {
  return {
    cookies: {
      get: vi.fn(async () => cookiesToRead),
      set: vi.fn(async () => undefined),
    },
    flushStorageData: vi.fn(async () => undefined),
  };
}

describe("migrateLegacyBrowserSessionPartition", () => {
  beforeEach(() => {
    fromPartition.mockReset();
  });

  it("copies legacy cookies into the h3code partition when the new partition is empty", async () => {
    const nextSession = createSession([]);
    const legacySession = createSession([
      {
        name: "sid",
        value: "abc123",
        domain: ".example.com",
        path: "/account",
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        session: false,
        expirationDate: 1_734_441_600,
      },
    ]);

    fromPartition.mockImplementation((partition: string) => {
      if (partition === "persist:h3code-browser") {
        return nextSession;
      }
      if (partition === "persist:t3code-browser") {
        return legacySession;
      }
      throw new Error(`unexpected partition ${partition}`);
    });

    await migrateLegacyBrowserSessionPartition();

    expect(nextSession.cookies.set).toHaveBeenCalledWith({
      url: "https://example.com/account",
      name: "sid",
      value: "abc123",
      domain: ".example.com",
      path: "/account",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      expirationDate: 1_734_441_600,
    });
    expect(nextSession.flushStorageData).toHaveBeenCalledTimes(1);
  });

  it("leaves the legacy partition alone when the h3code partition already has cookies", async () => {
    const nextSession = createSession([
      {
        name: "sid",
        value: "current",
        domain: ".example.com",
      },
    ]);
    const legacySession = createSession([
      {
        name: "sid",
        value: "legacy",
        domain: ".example.com",
      },
    ]);

    fromPartition.mockImplementation((partition: string) => {
      if (partition === "persist:h3code-browser") {
        return nextSession;
      }
      if (partition === "persist:t3code-browser") {
        return legacySession;
      }
      throw new Error(`unexpected partition ${partition}`);
    });

    await migrateLegacyBrowserSessionPartition();

    expect(nextSession.cookies.set).not.toHaveBeenCalled();
    expect(nextSession.flushStorageData).not.toHaveBeenCalled();
  });
});
