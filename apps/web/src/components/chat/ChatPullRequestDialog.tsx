import { memo } from "react";

import type { PullRequestDialogState } from "../ChatView.logic";
import { PullRequestThreadDialog } from "../PullRequestThreadDialog";

interface ChatPullRequestDialogProps {
  dialogState: PullRequestDialogState | null;
  cwd: string | null;
  onClose: () => void;
  onPrepared: (input: { branch: string; worktreePath: string | null }) => Promise<void> | void;
}

export const ChatPullRequestDialog = memo(function ChatPullRequestDialog({
  dialogState,
  cwd,
  onClose,
  onPrepared,
}: ChatPullRequestDialogProps) {
  if (!dialogState) {
    return null;
  }

  return (
    <PullRequestThreadDialog
      key={dialogState.key}
      open
      cwd={cwd}
      initialReference={dialogState.initialReference}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      onPrepared={onPrepared}
    />
  );
});
