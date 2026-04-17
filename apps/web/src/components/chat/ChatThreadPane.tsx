import type { ComponentProps, ReactNode } from "react";

import type { SidebarSide } from "../../appSettings";
import type { RateLimitStatus } from "./RateLimitBanner";
import type { ServerProviderStatus } from "@t3tools/contracts";
import { cn } from "~/lib/utils";

import TerminalWorkspaceTabs from "../TerminalWorkspaceTabs";
import { ChatBodyPane } from "./ChatBodyPane";
import { ChatHeader } from "./ChatHeader";
import { ProviderHealthBanner } from "./ProviderHealthBanner";
import { RateLimitBanner } from "./RateLimitBanner";
import { ThreadErrorBanner } from "./ThreadErrorBanner";

interface ChatThreadPaneProps {
  bodyProps: ComponentProps<typeof ChatBodyPane>;
  headerProps: ComponentProps<typeof ChatHeader>;
  isElectron: boolean;
  rateLimitStatus: RateLimitStatus | null;
  providerStatus: ServerProviderStatus | null;
  sidebarSide: SidebarSide;
  terminalDrawer: ReactNode;
  terminalWorkspaceOpen: boolean;
  terminalWorkspaceTabProps: ComponentProps<typeof TerminalWorkspaceTabs>;
  threadError: string | null;
  onDismissThreadError: () => void;
}

export function ChatThreadPane({
  bodyProps,
  headerProps,
  isElectron,
  rateLimitStatus,
  providerStatus,
  sidebarSide,
  terminalDrawer,
  terminalWorkspaceOpen,
  terminalWorkspaceTabProps,
  threadError,
  onDismissThreadError,
}: ChatThreadPaneProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header
        className={cn(
          "border-b border-border px-3 sm:px-5",
          isElectron ? "drag-region flex h-[52px] items-center" : "py-2 sm:py-3",
          isElectron && sidebarSide === "right" && "pl-[90px] sm:pl-[90px]",
        )}
      >
        <ChatHeader {...headerProps} />
      </header>

      <ProviderHealthBanner status={providerStatus} />
      <ThreadErrorBanner error={threadError} onDismiss={onDismissThreadError} />
      <RateLimitBanner rateLimitStatus={rateLimitStatus} />
      {terminalWorkspaceOpen ? <TerminalWorkspaceTabs {...terminalWorkspaceTabProps} /> : null}
      <ChatBodyPane {...bodyProps} />
      {terminalDrawer}
    </div>
  );
}
