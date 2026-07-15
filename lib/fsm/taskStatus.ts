import { TaskStatus } from "@/generated/prisma/enums";
import { TaskFsmError } from "./errors";

// Keep in sync with supabase/sql/003_status_fsm_trigger.sql - the DB trigger mirrors this
// table as defense in depth, since the client can never be trusted to send a valid next status.
export const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  yet_to_start: [TaskStatus.in_process],
  in_process: [TaskStatus.changes_required, TaskStatus.approval_sent],
  changes_required: [TaskStatus.in_process],
  approval_sent: [TaskStatus.completed, TaskStatus.changes_required],
  completed: [],
};

export function canTransitionStatus(from: TaskStatus, to: TaskStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function assertStatusTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionStatus(from, to)) {
    throw new TaskFsmError(from, to, "status");
  }
}
