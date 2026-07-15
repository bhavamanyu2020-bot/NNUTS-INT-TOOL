import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/generated/prisma/client";

const STATUS_STYLES: Record<TaskStatus, string> = {
  yet_to_start: "bg-neutral-100 text-neutral-700",
  in_process: "bg-blue-100 text-blue-700",
  changes_required: "bg-amber-100 text-amber-700",
  approval_sent: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
