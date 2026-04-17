import type { ComponentProps } from "react";

import { ChatThreadPane } from "./ChatThreadPane";

interface ChatViewShellProps {
  chatThreadPaneProps: ComponentProps<typeof ChatThreadPane>;
}

export function ChatViewShell({ chatThreadPaneProps }: ChatViewShellProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <ChatThreadPane {...chatThreadPaneProps} />
    </div>
  );
}
