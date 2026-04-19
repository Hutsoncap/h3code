import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { createWebAppBrowserSurfaceId } from "@t3tools/shared/browserSurface";
import BrowserPanel from "../components/BrowserPanel";
import { SidebarHeaderTrigger, SidebarInset } from "../components/ui/sidebar";
import { useWebAppsStore } from "../webAppsStore";

function WebAppRouteView() {
  const { webAppId } = Route.useParams();
  const navigate = useNavigate();
  const webApp = useWebAppsStore((store) => store.webApps.find((entry) => entry.id === webAppId));

  useEffect(() => {
    if (webApp) {
      return;
    }

    void navigate({ to: "/browser", replace: true });
  }, [navigate, webApp]);

  if (!webApp) {
    return (
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground" />
    );
  }

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <BrowserPanel
          mode="sidebar"
          surfaceId={createWebAppBrowserSurfaceId(webApp.id)}
          initialUrl={webApp.url}
          headerLeadingContent={<SidebarHeaderTrigger className="size-7 shrink-0" />}
          onClosePanel={() => {
            void navigate({ to: "/browser" });
          }}
        />
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/webapp/$webAppId")({
  component: WebAppRouteView,
});
