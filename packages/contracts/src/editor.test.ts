import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { EDITORS, EditorId, OpenInEditorInput } from "./editor";

const decodeEditorId = Schema.decodeUnknownSync(EditorId);
const decodeOpenInEditorInput = Schema.decodeUnknownSync(OpenInEditorInput);

describe("EditorId", () => {
  it("accepts every editor declared in the shared catalog", () => {
    expect(EDITORS.map((editor) => decodeEditorId(editor.id))).toEqual(
      EDITORS.map((editor) => editor.id),
    );
  });

  it("rejects unknown editor ids", () => {
    expect(() => decodeEditorId("unknown-editor")).toThrow();
  });
});

describe("OpenInEditorInput", () => {
  it("trims and parses editor launch payloads", () => {
    const parsed = decodeOpenInEditorInput({
      cwd: " /tmp/workspace ",
      editor: "vscode",
    });

    expect(parsed.cwd).toBe("/tmp/workspace");
    expect(parsed.editor).toBe("vscode");
  });

  it("rejects invalid editors", () => {
    expect(() =>
      decodeOpenInEditorInput({
        cwd: "/tmp/workspace",
        editor: "unknown-editor",
      }),
    ).toThrow();
  });
});
