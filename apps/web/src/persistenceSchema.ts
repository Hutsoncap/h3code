import {
  ProjectId,
  ThreadId,
  type ThreadBrowserState,
  ThreadBrowserStateSchema,
  TurnId,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";

const ChatRightPanelSchema = Schema.Literals(["browser", "diff"]);
const SplitViewPaneSchema = Schema.Literals(["left", "right"]);
const ThreadPrimarySurfaceSchema = Schema.Literals(["chat", "terminal"]);
const ThreadTerminalPresentationModeSchema = Schema.Literals(["drawer", "workspace"]);
const ThreadTerminalWorkspaceLayoutSchema = Schema.Literals(["both", "terminal-only"]);
const ThreadTerminalWorkspaceTabSchema = Schema.Literals(["terminal", "chat"]);
const TerminalCliKindSchema = Schema.Literals(["codex", "claude"]);
const TerminalAttentionStateSchema = Schema.Literals(["attention", "review"]);
const ThreadTerminalSplitDirectionSchema = Schema.Literals(["horizontal", "vertical"]);

export const PersistedRendererStateSchema = Schema.Struct({
  expandedProjectCwds: Schema.optionalKey(Schema.Array(Schema.String)),
  projectOrderCwds: Schema.optionalKey(Schema.Array(Schema.String)),
  projectNamesByCwd: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
});

export const PersistedPinnedThreadsStateSchema = Schema.Struct({
  pinnedThreadIds: Schema.Array(ThreadId),
});

export const PersistedSingleChatPanelStateSchema = Schema.Struct({
  panel: Schema.NullOr(ChatRightPanelSchema),
  diffTurnId: Schema.NullOr(TurnId),
  diffFilePath: Schema.NullOr(Schema.String),
  hasOpenedPanel: Schema.Boolean,
  lastOpenPanel: ChatRightPanelSchema,
});

export const PersistedSingleChatPanelStoreStateSchema = Schema.Struct({
  panelStateByThreadId: Schema.Record(Schema.String, PersistedSingleChatPanelStateSchema),
});

const BrowserHistoryEntrySchema = Schema.Struct({
  url: Schema.String,
  title: Schema.String,
  tabId: Schema.String,
});

export const PersistedBrowserStateSchema = Schema.Struct({
  threadStatesByThreadId: Schema.Record(Schema.String, ThreadBrowserStateSchema),
  recentHistoryByThreadId: Schema.Record(Schema.String, Schema.Array(BrowserHistoryEntrySchema)),
});

export const PersistedWorkspacePageSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  layoutPresetId: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export const PersistedWorkspaceStoreStateSchema = Schema.Struct({
  homeDir: Schema.NullOr(Schema.String),
  workspacePages: Schema.Array(PersistedWorkspacePageSchema),
});

const PersistedSplitViewPanePanelStateSchema = Schema.Struct({
  panel: Schema.NullOr(ChatRightPanelSchema),
  diffTurnId: Schema.NullOr(TurnId),
  diffFilePath: Schema.NullOr(Schema.String),
  hasOpenedPanel: Schema.Boolean,
  lastOpenPanel: ChatRightPanelSchema,
});

const PersistedSplitViewSchema = Schema.Struct({
  id: Schema.String,
  sourceThreadId: ThreadId,
  ownerProjectId: ProjectId,
  leftThreadId: Schema.NullOr(ThreadId),
  rightThreadId: Schema.NullOr(ThreadId),
  focusedPane: SplitViewPaneSchema,
  ratio: Schema.Number,
  leftPanel: PersistedSplitViewPanePanelStateSchema,
  rightPanel: PersistedSplitViewPanePanelStateSchema,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export const PersistedSplitViewStoreStateSchema = Schema.Struct({
  splitViewsById: Schema.Record(Schema.String, PersistedSplitViewSchema),
  splitViewIdBySourceThreadId: Schema.Record(Schema.String, Schema.String),
});

const PersistedThreadTerminalLeafNodeSchema = Schema.Struct({
  type: Schema.Literal("terminal"),
  paneId: Schema.String,
  terminalIds: Schema.Array(Schema.String),
  activeTerminalId: Schema.String,
});

const PersistedThreadTerminalLayoutNodeSchema: Schema.Schema<unknown> = Schema.suspend(() =>
  Schema.Union([
    PersistedThreadTerminalLeafNodeSchema,
    Schema.Struct({
      type: Schema.Literal("split"),
      id: Schema.String,
      direction: ThreadTerminalSplitDirectionSchema,
      children: Schema.Array(PersistedThreadTerminalLayoutNodeSchema),
      weights: Schema.Array(Schema.Number),
    }),
  ]),
);

const PersistedThreadTerminalGroupSchema = Schema.Struct({
  id: Schema.String,
  activeTerminalId: Schema.String,
  layout: PersistedThreadTerminalLayoutNodeSchema,
});

const PersistedThreadTerminalStateSchema = Schema.Struct({
  entryPoint: ThreadPrimarySurfaceSchema,
  terminalOpen: Schema.Boolean,
  presentationMode: ThreadTerminalPresentationModeSchema,
  workspaceLayout: ThreadTerminalWorkspaceLayoutSchema,
  workspaceActiveTab: ThreadTerminalWorkspaceTabSchema,
  terminalHeight: Schema.Number,
  terminalIds: Schema.Array(Schema.String),
  terminalLabelsById: Schema.Record(Schema.String, Schema.String),
  terminalTitleOverridesById: Schema.Record(Schema.String, Schema.String),
  terminalCliKindsById: Schema.Record(Schema.String, TerminalCliKindSchema),
  terminalAttentionStatesById: Schema.Record(Schema.String, TerminalAttentionStateSchema),
  runningTerminalIds: Schema.Array(Schema.String),
  activeTerminalId: Schema.String,
  terminalGroups: Schema.Array(PersistedThreadTerminalGroupSchema),
  activeTerminalGroupId: Schema.String,
});

export const PersistedTerminalStateStoreStateSchema = Schema.Struct({
  terminalStateByThreadId: Schema.Record(Schema.String, PersistedThreadTerminalStateSchema),
});

export function decodePersistedStateOrNull<S extends Schema.Top>(
  schema: S,
  input: unknown,
): Schema.Schema.Type<S> | null {
  try {
    return Schema.decodeUnknownSync(schema as never)(input) as Schema.Schema.Type<S>;
  } catch {
    return null;
  }
}

export function decodePersistedJsonOrNull<S extends Schema.Top>(
  schema: S,
  input: string,
): Schema.Schema.Type<S> | null {
  try {
    const decode = Schema.decodeSync(
      Schema.fromJsonString(schema as never) as never,
    ) as unknown as (value: string) => Schema.Schema.Type<S>;
    return decode(input);
  } catch {
    return null;
  }
}

export interface PersistedBrowserHistoryEntry {
  url: string;
  title: string;
  tabId: string;
}

export interface PersistedSingleChatPanelState {
  panel: "browser" | "diff" | null;
  diffTurnId: TurnId | null;
  diffFilePath: string | null;
  hasOpenedPanel: boolean;
  lastOpenPanel: "browser" | "diff";
}

export interface PersistedSplitViewPanePanelState extends PersistedSingleChatPanelState {}

export interface PersistedWorkspacePage {
  id: string;
  title: string;
  layoutPresetId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedBrowserState {
  threadStatesByThreadId: Record<string, ThreadBrowserState>;
  recentHistoryByThreadId: Record<string, PersistedBrowserHistoryEntry[]>;
}
