import { afterEach, describe, expect, it } from "vitest";

import { isTerminalFocused } from "./terminalFocus";

class MockHTMLElement {
  isConnected = false;
  className = "";
  inTerminalDrawer = false;

  readonly classList = {
    contains: (value: string) => this.className.split(/\s+/).includes(value),
  };

  closest(selector: string): MockHTMLElement | null {
    return selector === ".thread-terminal-drawer .xterm" &&
      this.isConnected &&
      this.inTerminalDrawer
      ? this
      : null;
  }
}

const originalDocument = globalThis.document;
const originalHTMLElement = globalThis.HTMLElement;

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as { document?: Document }).document;
  } else {
    globalThis.document = originalDocument;
  }

  if (originalHTMLElement === undefined) {
    delete (globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement;
  } else {
    globalThis.HTMLElement = originalHTMLElement;
  }
});

describe("isTerminalFocused", () => {
  it("returns false for non-HTMLElement active elements", () => {
    globalThis.HTMLElement = MockHTMLElement as unknown as typeof HTMLElement;
    globalThis.document = { activeElement: { isConnected: true } } as unknown as Document;

    expect(isTerminalFocused()).toBe(false);
  });

  it("returns false for detached xterm helper textareas", () => {
    const detached = new MockHTMLElement();
    detached.className = "xterm-helper-textarea";

    globalThis.HTMLElement = MockHTMLElement as unknown as typeof HTMLElement;
    globalThis.document = { activeElement: detached } as unknown as Document;

    expect(isTerminalFocused()).toBe(false);
  });

  it("returns true for connected xterm helper textareas", () => {
    const attached = new MockHTMLElement();
    attached.className = "xterm-helper-textarea";
    attached.isConnected = true;
    attached.inTerminalDrawer = true;

    globalThis.HTMLElement = MockHTMLElement as unknown as typeof HTMLElement;
    globalThis.document = { activeElement: attached } as unknown as Document;

    expect(isTerminalFocused()).toBe(true);
  });

  it("returns false for connected xterm helper textareas outside the terminal drawer", () => {
    const attached = new MockHTMLElement();
    attached.className = "xterm-helper-textarea";
    attached.isConnected = true;

    globalThis.HTMLElement = MockHTMLElement as unknown as typeof HTMLElement;
    globalThis.document = { activeElement: attached } as unknown as Document;

    expect(isTerminalFocused()).toBe(false);
  });

  it("returns false for connected xterm elements outside the terminal drawer", () => {
    const attached = new MockHTMLElement();
    attached.className = "xterm";
    attached.isConnected = true;

    globalThis.HTMLElement = MockHTMLElement as unknown as typeof HTMLElement;
    globalThis.document = { activeElement: attached } as unknown as Document;

    expect(isTerminalFocused()).toBe(false);
  });
});
