import type { ActivePlanState } from "../../session-logic";
import { ActivePlanCard } from "./ActivePlanCard";

interface ChatActivePlanCardProps {
  activePlan: ActivePlanState | null;
  backgroundTaskCount: number;
  onOpenSidebar: () => void;
}

export function ChatActivePlanCard({
  activePlan,
  backgroundTaskCount,
  onOpenSidebar,
}: ChatActivePlanCardProps) {
  if (!activePlan) {
    return null;
  }

  return (
    <div className="mx-auto w-11/12">
      <ActivePlanCard
        activePlan={activePlan}
        backgroundTaskCount={backgroundTaskCount}
        onOpenSidebar={onOpenSidebar}
      />
    </div>
  );
}
