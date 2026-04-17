import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

interface ChatComposerFooterProps {
  activePendingApprovalActions: ReactNode | null;
  isComposerFooterCompact: boolean;
  leftContent: ReactNode;
  rightContent: ReactNode;
}

export function ChatComposerFooter({
  activePendingApprovalActions,
  isComposerFooterCompact,
  leftContent,
  rightContent,
}: ChatComposerFooterProps) {
  if (activePendingApprovalActions) {
    return (
      <div className="flex items-center justify-end gap-2 px-3 pb-2">
        {activePendingApprovalActions}
      </div>
    );
  }

  return (
    <div
      data-chat-composer-footer="true"
      className={cn(
        "flex items-end justify-between px-2.5 pb-2",
        isComposerFooterCompact ? "gap-1.5" : "flex-wrap gap-1.5 sm:flex-nowrap sm:gap-0",
      )}
    >
      {leftContent}
      {rightContent}
    </div>
  );
}
