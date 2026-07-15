import { cn } from "@/lib/utils";
import type { TaskStage } from "@/generated/prisma/client";

const STAGE_STYLES: Record<TaskStage, string> = {
  onboarding: "text-neutral-600 bg-neutral-50",
  marketing: "text-orange-700 bg-orange-50",
  production: "text-indigo-700 bg-indigo-50",
  post_production: "text-teal-700 bg-teal-50",
  closed: "text-green-700 bg-green-50",
};

const DOT_STYLES: Record<TaskStage, string> = {
  onboarding: "bg-neutral-400",
  marketing: "bg-orange-500",
  production: "bg-indigo-500",
  post_production: "bg-teal-500",
  closed: "bg-green-500",
};

export function TaskStageBadge({ stage }: { stage: TaskStage }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        STAGE_STYLES[stage],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_STYLES[stage])} />
      {stage.replace(/_/g, " ")}
    </span>
  );
}
