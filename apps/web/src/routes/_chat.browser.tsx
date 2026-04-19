import { type BrowserSurfaceId } from "@t3tools/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import BrowserPanel from "../components/BrowserPanel";
import { SidebarHeaderTrigger, SidebarInset } from "../components/ui/sidebar";
import { createStandaloneBrowserSurfaceId } from "@t3tools/shared/browserSurface";

const STANDALONE_BROWSER_SURFACE_ID = createStandaloneBrowserSurfaceId(
  "main",
) satisfies BrowserSurfaceId;

function BrowserRouteView() {
  const navigate = useNavigate();

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <BrowserPanel
          mode="sidebar"
          surfaceId={STANDALONE_BROWSER_SURFACE_ID}
          headerLeadingContent={<SidebarHeaderTrigger className="size-7 shrink-0" />}
          onClosePanel={() => {
            void navigate({ to: "/" });
          }}
        />
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/browser")({
  component: BrowserRouteView,
});
