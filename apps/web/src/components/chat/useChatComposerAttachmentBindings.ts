// FILE: useChatComposerAttachmentBindings.ts
// Purpose: Own ChatView's composer image attachment ingestion and drag-drop behavior.
// Layer: ChatView hook
// Depends on: composer draft attachment setters plus thread-level error reporting.

import {
  PROVIDER_SEND_TURN_MAX_ATTACHMENTS,
  PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
  type ThreadId,
} from "@t3tools/contracts";
import { randomUUID } from "~/lib/utils";
import { type MutableRefObject, useCallback, useRef, useState } from "react";

import { type ComposerImageAttachment } from "../../composerDraftStore";
import { toastManager } from "../ui/toast";

interface UseChatComposerAttachmentBindingsOptions {
  activeThreadId: ThreadId | null;
  addComposerImage: (image: ComposerImageAttachment) => void;
  addComposerImagesToDraft: (images: ComposerImageAttachment[]) => void;
  composerImagesRef: MutableRefObject<ComposerImageAttachment[]>;
  focusComposer: () => void;
  imageSizeLimitLabel: string;
  pendingUserInputCount: number;
  removeComposerImageFromDraft: (imageId: string) => void;
  setThreadError: (threadId: ThreadId, error: string | null) => void;
}

interface UseChatComposerAttachmentBindingsResult {
  addComposerImages: (files: File[]) => void;
  isDragOverComposer: boolean;
  onComposerDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  onComposerDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onComposerDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onComposerDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onComposerPaste: (event: React.ClipboardEvent<HTMLElement>) => void;
  removeComposerImage: (imageId: string) => void;
  resetComposerAttachmentUi: () => void;
}

// Keeps attachment ingestion together so ChatView only wires the composer surface and thread resets.
export function useChatComposerAttachmentBindings(
  options: UseChatComposerAttachmentBindingsOptions,
): UseChatComposerAttachmentBindingsResult {
  const {
    activeThreadId,
    addComposerImage,
    addComposerImagesToDraft,
    composerImagesRef,
    focusComposer,
    imageSizeLimitLabel,
    pendingUserInputCount,
    removeComposerImageFromDraft,
    setThreadError,
  } = options;

  const [isDragOverComposer, setIsDragOverComposer] = useState(false);
  const dragDepthRef = useRef(0);

  const resetComposerAttachmentUi = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDragOverComposer(false);
  }, []);

  const addComposerImages = useCallback(
    (files: File[]) => {
      if (!activeThreadId || files.length === 0) return;

      if (pendingUserInputCount > 0) {
        toastManager.add({
          type: "error",
          title: "Attach images after answering plan questions.",
        });
        return;
      }

      const nextImages: ComposerImageAttachment[] = [];
      let nextImageCount = composerImagesRef.current.length;
      let error: string | null = null;
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          error = `Unsupported file type for '${file.name}'. Please attach image files only.`;
          continue;
        }
        if (file.size > PROVIDER_SEND_TURN_MAX_IMAGE_BYTES) {
          error = `'${file.name}' exceeds the ${imageSizeLimitLabel} attachment limit.`;
          continue;
        }
        if (nextImageCount >= PROVIDER_SEND_TURN_MAX_ATTACHMENTS) {
          error = `You can attach up to ${PROVIDER_SEND_TURN_MAX_ATTACHMENTS} images per message.`;
          break;
        }

        const previewUrl = URL.createObjectURL(file);
        nextImages.push({
          type: "image",
          id: randomUUID(),
          name: file.name || "image",
          mimeType: file.type,
          sizeBytes: file.size,
          previewUrl,
          file,
        });
        nextImageCount += 1;
      }

      if (nextImages.length === 1 && nextImages[0]) {
        addComposerImage(nextImages[0]);
      } else if (nextImages.length > 1) {
        addComposerImagesToDraft(nextImages);
      }
      setThreadError(activeThreadId, error);
    },
    [
      activeThreadId,
      addComposerImage,
      addComposerImagesToDraft,
      composerImagesRef,
      imageSizeLimitLabel,
      pendingUserInputCount,
      setThreadError,
    ],
  );

  const removeComposerImage = useCallback(
    (imageId: string) => {
      removeComposerImageFromDraft(imageId);
    },
    [removeComposerImageFromDraft],
  );

  const onComposerPaste = useCallback(
    (event: React.ClipboardEvent<HTMLElement>) => {
      const files = Array.from(event.clipboardData.files);
      if (files.length === 0) {
        return;
      }
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        return;
      }
      event.preventDefault();
      addComposerImages(imageFiles);
    },
    [addComposerImages],
  );

  const onComposerDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOverComposer(true);
  }, []);

  const onComposerDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOverComposer(true);
  }, []);

  const onComposerDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOverComposer(false);
    }
  }, []);

  const onComposerDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes("Files")) {
        return;
      }
      event.preventDefault();
      resetComposerAttachmentUi();
      const files = Array.from(event.dataTransfer.files);
      addComposerImages(files);
      focusComposer();
    },
    [addComposerImages, focusComposer, resetComposerAttachmentUi],
  );

  return {
    addComposerImages,
    isDragOverComposer,
    onComposerDragEnter,
    onComposerDragLeave,
    onComposerDragOver,
    onComposerDrop,
    onComposerPaste,
    removeComposerImage,
    resetComposerAttachmentUi,
  };
}
