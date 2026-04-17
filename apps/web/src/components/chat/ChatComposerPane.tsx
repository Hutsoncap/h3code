import type { DragEventHandler, FormEventHandler, ReactNode, RefObject } from "react";
import { PiArrowBendDownRight } from "react-icons/pi";

import type { QueuedComposerTurn } from "../../composerDraftStore";
import { EllipsisIcon, Trash2 } from "~/lib/icons";
import { cn } from "~/lib/utils";

import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";

interface ChatComposerPaneProps {
  activePlanCard: ReactNode;
  bottomPaddingClassName: string;
  composerCommandMenu: ReactNode;
  composerFooter: ReactNode;
  composerFormRef: RefObject<HTMLFormElement | null>;
  composerFrameClassName: string | undefined;
  composerImageAttachments: ReactNode;
  composerPromptEditor: ReactNode;
  composerStatusBanner: ReactNode;
  composerSurfaceClassName: string | undefined;
  isDragOverComposer: boolean;
  onComposerDragEnter: DragEventHandler<HTMLDivElement>;
  onComposerDragLeave: DragEventHandler<HTMLDivElement>;
  onComposerDragOver: DragEventHandler<HTMLDivElement>;
  onComposerDrop: DragEventHandler<HTMLDivElement>;
  onEditQueuedComposerTurn: (queuedTurn: QueuedComposerTurn) => void;
  onRemoveQueuedComposerTurn: (queuedTurnId: QueuedComposerTurn["id"]) => void;
  onSend: FormEventHandler<HTMLFormElement>;
  onSteerQueuedComposerTurn: (queuedTurn: QueuedComposerTurn) => void | Promise<void>;
  paneScopeId: string;
  queuedComposerTurns: QueuedComposerTurn[];
}

export function ChatComposerPane({
  activePlanCard,
  bottomPaddingClassName,
  composerCommandMenu,
  composerFooter,
  composerFormRef,
  composerFrameClassName,
  composerImageAttachments,
  composerPromptEditor,
  composerStatusBanner,
  composerSurfaceClassName,
  isDragOverComposer,
  onComposerDragEnter,
  onComposerDragLeave,
  onComposerDragOver,
  onComposerDrop,
  onEditQueuedComposerTurn,
  onRemoveQueuedComposerTurn,
  onSend,
  onSteerQueuedComposerTurn,
  paneScopeId,
  queuedComposerTurns,
}: ChatComposerPaneProps) {
  return (
    <div className={cn("px-3 pt-0 sm:px-5 sm:pt-0", bottomPaddingClassName)}>
      {activePlanCard ? <div className="mx-auto w-full max-w-3xl">{activePlanCard}</div> : null}
      <form
        ref={composerFormRef}
        onSubmit={onSend}
        className="relative z-10 mx-auto w-full min-w-0 max-w-3xl"
        data-chat-composer-form="true"
        data-chat-pane-scope={paneScopeId}
      >
        {queuedComposerTurns.length > 0 ? (
          <div className="mx-auto flex w-11/12 flex-col">
            {queuedComposerTurns.map((queuedTurn) => (
              <div
                key={queuedTurn.id}
                data-testid="queued-follow-up-row"
                className="chat-composer-surface flex items-center gap-2 rounded-t-2xl border border-b-0 border-border/60 bg-card px-2.5 py-2 text-[12px]"
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <PiArrowBendDownRight className="size-3 shrink-0 text-muted-foreground/70" />
                  <span className="truncate text-[12px] font-medium text-foreground/85">
                    {queuedTurn.previewText}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg bg-muted/80 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                    onClick={() => void onSteerQueuedComposerTurn(queuedTurn)}
                  >
                    <PiArrowBendDownRight className="size-3" />
                    <span>Steer</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
                    aria-label="Delete queued follow-up"
                    onClick={() => onRemoveQueuedComposerTurn(queuedTurn.id)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                  <Menu>
                    <MenuTrigger
                      render={
                        <button
                          type="button"
                          className="inline-flex size-6 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
                          aria-label="Queued follow-up actions"
                        />
                      }
                    >
                      <EllipsisIcon className="size-3" />
                    </MenuTrigger>
                    <MenuPopup align="end" side="top">
                      <MenuItem onClick={() => onEditQueuedComposerTurn(queuedTurn)}>
                        Edit queued prompt
                      </MenuItem>
                      <MenuItem onClick={() => onRemoveQueuedComposerTurn(queuedTurn.id)}>
                        Delete queued prompt
                      </MenuItem>
                    </MenuPopup>
                  </Menu>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div
          className={cn(
            "group rounded-3xl p-px transition-colors duration-200",
            composerFrameClassName,
          )}
          onDragEnter={onComposerDragEnter}
          onDragOver={onComposerDragOver}
          onDragLeave={onComposerDragLeave}
          onDrop={onComposerDrop}
        >
          <div
            className={cn(
              "chat-composer-surface rounded-2xl border bg-card transition-colors duration-200 focus-within:border-neutral-500/15",
              isDragOverComposer ? "border-primary/50 bg-accent/20" : "border-border/60",
              composerSurfaceClassName,
            )}
          >
            {composerStatusBanner ? (
              <div className="rounded-t-[23px] border-b border-border/65 bg-muted/20">
                {composerStatusBanner}
              </div>
            ) : null}
            <div className={cn("relative px-3.5 pb-1 pt-3")}>
              {composerCommandMenu}
              {composerImageAttachments}
              {composerPromptEditor}
            </div>
            {composerFooter}
          </div>
        </div>
      </form>
    </div>
  );
}
