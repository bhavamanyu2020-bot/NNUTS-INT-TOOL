import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/generated/prisma/client";

const STATUS_STYLES: Record<TaskStatus, string> = {
  yet_to_start: "text-neutral-600 bg-neutral-50",
  in_process: "text-blue-700 bg-blue-50",
  changes_required: "text-amber-700 bg-amber-50",
  approval_sent: "text-purple-700 bg-purple-50",
  completed: "text-green-700 bg-green-50",
};

const DOT_STYLES: Record<TaskStatus, string> = {
  yet_to_start: "bg-neutral-400",
  in_process: "bg-blue-500",
  changes_required: "bg-amber-500",
  approval_sent: "bg-purple-500",
  completed: "bg-green-500",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_STYLES[status])} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
