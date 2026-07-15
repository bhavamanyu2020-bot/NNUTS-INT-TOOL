import { cn } from "@/lib/utils";
import type { TaskStage } from "@/generated/prisma/client";

const STAGE_STYLES: Record<TaskStage, string> = {
  onboarding: "bg-neutral-100 text-neutral-700",
  marketing: "bg-orange-100 text-orange-700",
  production: "bg-indigo-100 text-indigo-700",
  post_production: "bg-teal-100 text-teal-700",
  closed: "bg-green-100 text-green-700",
};

export function TaskStageBadge({ stage }: { stage: TaskStage }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        STAGE_STYLES[stage],
      )}
    >
      {stage.replace(/_/g, " ")}
    </span>
  );
}
