import { ProjectId, ThreadId, TurnId } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolvePreferredSplitViewIdForThread, useSplitViewStore } from "./splitViewStore";

const PROJECT_ID = ProjectId.makeUnsafe("project-1");
const THREAD_A = ThreadId.makeUnsafe("thread-a");
const THREAD_B = ThreadId.makeUnsafe("thread-b");
const THREAD_C = ThreadId.makeUnsafe("thread-c");
const TURN_ID = TurnId.makeUnsafe("turn-1");
const ORIGINAL_LOCAL_STORAGE = globalThis.localStorage;

describe("splitViewStore", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
    } as Storage;
    useSplitViewStore.setState({
      splitViewsById: {},
      splitViewIdBySourceThreadId: {},
    });
  });

  afterEach(() => {
    globalThis.localStorage = ORIGINAL_LOCAL_STORAGE;
  });

  it("removes a deleted thread from every split that references it", () => {
    const store = useSplitViewStore.getState();
    const firstSplitId = store.createFromThread({
      sourceThreadId: THREAD_A,
      ownerProjectId: PROJECT_ID,
    });
    store.replacePaneThread(firstSplitId, "right", THREAD_B);
    store.setPanePanelState(firstSplitId, "left", {
      panel: "diff",
      diffTurnId: TURN_ID,
      diffFilePath: "src/left.ts",
      hasOpenedPanel: true,
      lastOpenPanel: "diff",
    });

    const secondSplitId = store.createFromThread({
      sourceThreadId: THREAD_C,
      ownerProjectId: PROJECT_ID,
    });
    store.replacePaneThread(secondSplitId, "right", THREAD_A);
    store.setFocusedPane(secondSplitId, "right");

    useSplitViewStore.getState().removeThreadFromSplitViews(THREAD_A);

    const nextState = useSplitViewStore.getState();
    expect(nextState.splitViewIdBySourceThreadId[THREAD_A]).toBeUndefined();
    expect(nextState.splitViewsById[firstSplitId]).toMatchObject({
      leftThreadId: null,
      rightThreadId: THREAD_B,
      focusedPane: "right",
      leftPanel: {
        panel: null,
        diffTurnId: null,
        diffFilePath: null,
      },
    });
    expect(nextState.splitViewsById[secondSplitId]).toMatchObject({
      leftThreadId: THREAD_C,
      rightThreadId: null,
      focusedPane: "left",
    });
    expect(nextState.splitViewIdBySourceThreadId[THREAD_C]).toBe(secondSplitId);
  });

  it("removes an empty split entirely after deleting its last thread", () => {
    const store = useSplitViewStore.getState();
    const splitId = store.createFromThread({
      sourceThreadId: THREAD_A,
      ownerProjectId: PROJECT_ID,
    });

    useSplitViewStore.getState().removeThreadFromSplitViews(THREAD_A);

    const nextState = useSplitViewStore.getState();
    expect(nextState.splitViewsById[splitId]).toBeUndefined();
    expect(nextState.splitViewIdBySourceThreadId[THREAD_A]).toBeUndefined();
  });

  it("prefers the source split for a thread before other matching splits", () => {
    const store = useSplitViewStore.getState();
    const sourceSplitId = store.createFromThread({
      sourceThreadId: THREAD_A,
      ownerProjectId: PROJECT_ID,
    });
    const otherSplitId = store.createFromThread({
      sourceThreadId: THREAD_C,
      ownerProjectId: PROJECT_ID,
    });
    store.replacePaneThread(otherSplitId, "right", THREAD_A);

    expect(
      resolvePreferredSplitViewIdForThread({
        splitViewsById: useSplitViewStore.getState().splitViewsById,
        splitViewIdBySourceThreadId: useSplitViewStore.getState().splitViewIdBySourceThreadId,
        threadId: THREAD_A,
      }),
    ).toBe(sourceSplitId);
  });

  it("falls back to the most recently updated matching split for non-source threads", () => {
    const store = useSplitViewStore.getState();
    const olderSplitId = store.createFromThread({
      sourceThreadId: THREAD_A,
      ownerProjectId: PROJECT_ID,
    });
    store.replacePaneThread(olderSplitId, "right", THREAD_B);

    const newerSplitId = store.createFromThread({
      sourceThreadId: THREAD_C,
      ownerProjectId: PROJECT_ID,
    });
    store.replacePaneThread(newerSplitId, "right", THREAD_B);
    useSplitViewStore.setState((state) => ({
      splitViewsById: {
        ...state.splitViewsById,
        [olderSplitId]: state.splitViewsById[olderSplitId]
          ? { ...state.splitViewsById[olderSplitId], updatedAt: "2026-04-07T10:00:00.000Z" }
          : undefined,
        [newerSplitId]: state.splitViewsById[newerSplitId]
          ? { ...state.splitViewsById[newerSplitId], updatedAt: "2026-04-07T10:01:00.000Z" }
          : undefined,
      },
    }));

    expect(
      resolvePreferredSplitViewIdForThread({
        splitViewsById: useSplitViewStore.getState().splitViewsById,
        splitViewIdBySourceThreadId: useSplitViewStore.getState().splitViewIdBySourceThreadId,
        threadId: THREAD_B,
      }),
    ).toBe(newerSplitId);
  });

  it("rebuilds the source-thread mapping from valid persisted split views", () => {
    const persistApi = useSplitViewStore.persist as unknown as {
      getOptions: () => {
        merge: (
          persistedState: unknown,
          currentState: ReturnType<typeof useSplitViewStore.getState>,
        ) => ReturnType<typeof useSplitViewStore.getState>;
      };
    };

    const mergedState = persistApi.getOptions().merge(
      {
        splitViewsById: {
          "split-1": {
            id: "split-1",
            sourceThreadId: THREAD_A,
            ownerProjectId: PROJECT_ID,
            leftThreadId: THREAD_A,
            rightThreadId: THREAD_B,
            focusedPane: "right",
            ratio: 0.9,
            leftPanel: {
              panel: null,
              diffTurnId: null,
              diffFilePath: null,
              hasOpenedPanel: false,
              lastOpenPanel: "browser",
            },
            rightPanel: {
              panel: "diff",
              diffTurnId: TURN_ID,
              diffFilePath: "src/right.ts",
              hasOpenedPanel: true,
              lastOpenPanel: "diff",
            },
            createdAt: "2026-04-17T09:00:00.000Z",
            updatedAt: "2026-04-17T09:01:00.000Z",
          },
        },
        splitViewIdBySourceThreadId: {
          [THREAD_C]: "stale-split-id",
        },
      },
      useSplitViewStore.getInitialState(),
    );

    expect(mergedState.splitViewsById["split-1"]).toMatchObject({
      sourceThreadId: THREAD_A,
      ratio: 0.75,
    });
    expect(mergedState.splitViewIdBySourceThreadId).toEqual({
      [THREAD_A]: "split-1",
    });
  });
});
