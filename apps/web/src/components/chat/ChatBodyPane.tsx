// FILE: ChatBodyPane.tsx
// Purpose: Compose the active-thread chat shell so ChatView can stay focused on state wiring.
// Layer: Chat shell layout
// Depends on: extracted transcript/composer panes and terminal/sidebar chrome from ChatView.

import type { ComponentProps, ReactNode } from "react";

import { cn } from "~/lib/utils";

import { ChatComposerPane } from "./ChatComposerPane";
import { ChatTranscriptPane } from "./ChatTranscriptPane";

interface ChatBodyPaneProps {
  branchToolbar: ReactNode;
  chatComposerPaneProps: ComponentProps<typeof ChatComposerPane>;
  chatTranscriptPaneProps: ComponentProps<typeof ChatTranscriptPane>;
  planSidebar: ReactNode;
  pullRequestDialog: ReactNode;
  terminalWorkspaceOpen: boolean;
  terminalWorkspaceTerminalTabActive: boolean;
  workspaceTerminalDrawer: ReactNode;
}

export function ChatBodyPane({
  branchToolbar,
  chatComposerPaneProps,
  chatTranscriptPaneProps,
  planSidebar,
  pullRequestDialog,
  terminalWorkspaceOpen,
  terminalWorkspaceTerminalTabActive,
  workspaceTerminalDrawer,
}: ChatBodyPaneProps) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          aria-hidden={terminalWorkspaceTerminalTabActive}
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            terminalWorkspaceTerminalTabActive ? "pointer-events-none invisible" : "",
          )}
        >
          <ChatTranscriptPane {...chatTranscriptPaneProps} />
          <ChatComposerPane {...chatComposerPaneProps} />
          {branchToolbar}
          {pullRequestDialog}
        </div>

        {terminalWorkspaceOpen ? workspaceTerminalDrawer : null}
      </div>

      {planSidebar}
    </div>
  );
}
