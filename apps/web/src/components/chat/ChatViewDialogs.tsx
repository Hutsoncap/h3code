import type { ComponentProps } from "react";

import { ComposerSlashStatusDialog } from "./ComposerSlashStatusDialog";
import { ThreadWorktreeHandoffDialog } from "../ThreadWorktreeHandoffDialog";

interface ChatViewDialogsProps {
  composerSlashStatusDialogProps: ComponentProps<typeof ComposerSlashStatusDialog>;
  threadWorktreeHandoffDialogProps: ComponentProps<typeof ThreadWorktreeHandoffDialog>;
}

export function ChatViewDialogs({
  composerSlashStatusDialogProps,
  threadWorktreeHandoffDialogProps,
}: ChatViewDialogsProps) {
  return (
    <>
      <ComposerSlashStatusDialog {...composerSlashStatusDialogProps} />
      <ThreadWorktreeHandoffDialog {...threadWorktreeHandoffDialogProps} />
    </>
  );
}
