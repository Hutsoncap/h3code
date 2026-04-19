import { type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { DisclosureChevron } from "../ui/DisclosureChevron";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

interface SidebarSectionProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SidebarSection({
  title,
  open,
  onOpenChange,
  action,
  children,
  className,
  contentClassName,
}: SidebarSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2 px-2 py-1">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-0 py-1 text-left hover:text-foreground">
          <DisclosureChevron open={open} className="size-3 text-muted-foreground/60" />
          <span className="truncate text-[length:var(--app-font-size-ui,12px)] font-normal tracking-tight text-muted-foreground/58">
            {title}
          </span>
        </CollapsibleTrigger>
        {action ? <div className="-mr-1 flex items-center gap-1.5">{action}</div> : null}
      </div>
      <CollapsibleContent className={cn("overflow-visible", contentClassName)}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
