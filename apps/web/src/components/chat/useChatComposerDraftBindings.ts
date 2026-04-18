import { type ThreadId } from "@t3tools/contracts";
import { useCallback, useMemo } from "react";

import {
  type ComposerImageAttachment,
  useComposerDraftStore,
  useComposerThreadDraft,
} from "../../composerDraftStore";
import { type TerminalContextDraft } from "../../lib/terminalContext";
import { deriveComposerSendState } from "../ChatView.logic";

function createChatComposerDraftBindings(input: {
  addComposerImage: (image: ComposerImageAttachment) => void;
  addComposerImagesToDraft: (images: ComposerImageAttachment[]) => void;
  addComposerTerminalContextsToDraft: (contexts: TerminalContextDraft[]) => void;
  clearComposerDraftContent: ReturnType<
    typeof useComposerDraftStore.getState
  >["clearComposerContent"];
  clearComposerDraftPersistedAttachments: ReturnType<
    typeof useComposerDraftStore.getState
  >["clearPersistedAttachments"];
  clearProjectDraftThreadId: ReturnType<
    typeof useComposerDraftStore.getState
  >["clearProjectDraftThreadId"];
  composerDraft: ReturnType<typeof useComposerThreadDraft>;
  composerImages: ReturnType<typeof useComposerThreadDraft>["images"];
  composerSendState: ReturnType<typeof deriveComposerSendState>;
  composerTerminalContexts: ReturnType<typeof useComposerThreadDraft>["terminalContexts"];
  draftThread:
    | ReturnType<typeof useComposerDraftStore.getState>["draftThreadsByThreadId"][ThreadId]
    | null;
  enqueueQueuedComposerTurn: ReturnType<typeof useComposerDraftStore.getState>["enqueueQueuedTurn"];
  getDraftThread: ReturnType<typeof useComposerDraftStore.getState>["getDraftThread"];
  getDraftThreadByProjectId: ReturnType<
    typeof useComposerDraftStore.getState
  >["getDraftThreadByProjectId"];
  insertComposerDraftTerminalContext: ReturnType<
    typeof useComposerDraftStore.getState
  >["insertTerminalContext"];
  insertQueuedComposerTurn: ReturnType<typeof useComposerDraftStore.getState>["insertQueuedTurn"];
  nonPersistedComposerImageIds: ReturnType<typeof useComposerThreadDraft>["nonPersistedImageIds"];
  prompt: string;
  queuedComposerTurns: ReturnType<typeof useComposerThreadDraft>["queuedTurns"];
  removeComposerDraftTerminalContext: ReturnType<
    typeof useComposerDraftStore.getState
  >["removeTerminalContext"];
  removeComposerImageFromDraft: (imageId: string) => void;
  removeQueuedComposerTurnFromDraft: ReturnType<
    typeof useComposerDraftStore.getState
  >["removeQueuedTurn"];
  setComposerDraftInteractionMode: ReturnType<
    typeof useComposerDraftStore.getState
  >["setInteractionMode"];
  setComposerDraftModelSelection: ReturnType<
    typeof useComposerDraftStore.getState
  >["setModelSelection"];
  setComposerDraftPrompt: ReturnType<typeof useComposerDraftStore.getState>["setPrompt"];
  setComposerDraftProviderModelOptions: ReturnType<
    typeof useComposerDraftStore.getState
  >["setProviderModelOptions"];
  setComposerDraftRuntimeMode: ReturnType<typeof useComposerDraftStore.getState>["setRuntimeMode"];
  setComposerDraftTerminalContexts: ReturnType<
    typeof useComposerDraftStore.getState
  >["setTerminalContexts"];
  setDraftThreadContext: ReturnType<typeof useComposerDraftStore.getState>["setDraftThreadContext"];
  setProjectDraftThreadId: ReturnType<
    typeof useComposerDraftStore.getState
  >["setProjectDraftThreadId"];
  setPrompt: (nextPrompt: string) => void;
  setStickyComposerModelSelection: ReturnType<
    typeof useComposerDraftStore.getState
  >["setStickyModelSelection"];
  syncComposerDraftPersistedAttachments: ReturnType<
    typeof useComposerDraftStore.getState
  >["syncPersistedAttachments"];
}) {
  return input;
}

export function useChatComposerDraftBindings(
  threadId: ThreadId,
): ReturnType<typeof createChatComposerDraftBindings> {
  const composerDraft = useComposerThreadDraft(threadId);
  const prompt = composerDraft.prompt;
  const composerImages = composerDraft.images;
  const composerTerminalContexts = composerDraft.terminalContexts;
  const queuedComposerTurns = composerDraft.queuedTurns;
  const nonPersistedComposerImageIds = composerDraft.nonPersistedImageIds;

  const composerSendState = useMemo(
    () =>
      deriveComposerSendState({
        prompt,
        imageCount: composerImages.length,
        terminalContexts: composerTerminalContexts,
      }),
    [composerImages.length, composerTerminalContexts, prompt],
  );

  const setStickyComposerModelSelection = useComposerDraftStore(
    (store) => store.setStickyModelSelection,
  );
  const setComposerDraftPrompt = useComposerDraftStore((store) => store.setPrompt);
  const setComposerDraftModelSelection = useComposerDraftStore((store) => store.setModelSelection);
  const setComposerDraftProviderModelOptions = useComposerDraftStore(
    (store) => store.setProviderModelOptions,
  );
  const setComposerDraftRuntimeMode = useComposerDraftStore((store) => store.setRuntimeMode);
  const setComposerDraftInteractionMode = useComposerDraftStore(
    (store) => store.setInteractionMode,
  );
  const enqueueQueuedComposerTurn = useComposerDraftStore((store) => store.enqueueQueuedTurn);
  const insertQueuedComposerTurn = useComposerDraftStore((store) => store.insertQueuedTurn);
  const removeQueuedComposerTurnFromDraft = useComposerDraftStore(
    (store) => store.removeQueuedTurn,
  );
  const addComposerDraftImage = useComposerDraftStore((store) => store.addImage);
  const addComposerDraftImages = useComposerDraftStore((store) => store.addImages);
  const removeComposerDraftImage = useComposerDraftStore((store) => store.removeImage);
  const insertComposerDraftTerminalContext = useComposerDraftStore(
    (store) => store.insertTerminalContext,
  );
  const addComposerDraftTerminalContexts = useComposerDraftStore(
    (store) => store.addTerminalContexts,
  );
  const removeComposerDraftTerminalContext = useComposerDraftStore(
    (store) => store.removeTerminalContext,
  );
  const setComposerDraftTerminalContexts = useComposerDraftStore(
    (store) => store.setTerminalContexts,
  );
  const clearComposerDraftPersistedAttachments = useComposerDraftStore(
    (store) => store.clearPersistedAttachments,
  );
  const syncComposerDraftPersistedAttachments = useComposerDraftStore(
    (store) => store.syncPersistedAttachments,
  );
  const clearComposerDraftContent = useComposerDraftStore((store) => store.clearComposerContent);
  const setDraftThreadContext = useComposerDraftStore((store) => store.setDraftThreadContext);
  const getDraftThreadByProjectId = useComposerDraftStore(
    (store) => store.getDraftThreadByProjectId,
  );
  const getDraftThread = useComposerDraftStore((store) => store.getDraftThread);
  const setProjectDraftThreadId = useComposerDraftStore((store) => store.setProjectDraftThreadId);
  const clearProjectDraftThreadId = useComposerDraftStore(
    (store) => store.clearProjectDraftThreadId,
  );
  const draftThread = useComposerDraftStore(
    (store) => store.draftThreadsByThreadId[threadId] ?? null,
  );

  const setPrompt = useCallback(
    (nextPrompt: string) => {
      setComposerDraftPrompt(threadId, nextPrompt);
    },
    [setComposerDraftPrompt, threadId],
  );

  const addComposerImage = useCallback(
    (image: ComposerImageAttachment) => {
      addComposerDraftImage(threadId, image);
    },
    [addComposerDraftImage, threadId],
  );

  const addComposerImagesToDraft = useCallback(
    (images: ComposerImageAttachment[]) => {
      addComposerDraftImages(threadId, images);
    },
    [addComposerDraftImages, threadId],
  );

  const addComposerTerminalContextsToDraft = useCallback(
    (contexts: TerminalContextDraft[]) => {
      addComposerDraftTerminalContexts(threadId, contexts);
    },
    [addComposerDraftTerminalContexts, threadId],
  );

  const removeComposerImageFromDraft = useCallback(
    (imageId: string) => {
      removeComposerDraftImage(threadId, imageId);
    },
    [removeComposerDraftImage, threadId],
  );

  return createChatComposerDraftBindings({
    addComposerImage,
    addComposerImagesToDraft,
    addComposerTerminalContextsToDraft,
    clearComposerDraftContent,
    clearComposerDraftPersistedAttachments,
    clearProjectDraftThreadId,
    composerDraft,
    composerImages,
    composerSendState,
    composerTerminalContexts,
    draftThread,
    enqueueQueuedComposerTurn,
    getDraftThread,
    getDraftThreadByProjectId,
    insertQueuedComposerTurn,
    nonPersistedComposerImageIds,
    prompt,
    queuedComposerTurns,
    removeComposerDraftTerminalContext,
    removeComposerImageFromDraft,
    removeQueuedComposerTurnFromDraft,
    setComposerDraftInteractionMode,
    setComposerDraftModelSelection,
    setComposerDraftPrompt,
    setComposerDraftProviderModelOptions,
    setComposerDraftRuntimeMode,
    setComposerDraftTerminalContexts,
    setDraftThreadContext,
    setProjectDraftThreadId,
    setPrompt,
    setStickyComposerModelSelection,
    syncComposerDraftPersistedAttachments,
    insertComposerDraftTerminalContext,
  });
}
