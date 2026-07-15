import { TaskStage } from "@/generated/prisma/enums";
import { TaskFsmError } from "./errors";

// Keep in sync with supabase/sql/004_stage_fsm_trigger.sql.
// Linear forward-only. super_admin may bypass via forceStageTransition (server/actions/tasks.ts),
// which is gated by role rather than by loosening this guard for everyone.
export const STAGE_TRANSITIONS: Record<TaskStage, TaskStage[]> = {
  onboarding: [TaskStage.marketing],
  marketing: [TaskStage.production],
  production: [TaskStage.post_production],
  post_production: [TaskStage.closed],
  closed: [],
};

export function canTransitionStage(from: TaskStage, to: TaskStage): boolean {
  return STAGE_TRANSITIONS[from].includes(to);
}

export function assertStageTransition(from: TaskStage, to: TaskStage): void {
  if (!canTransitionStage(from, to)) {
    throw new TaskFsmError(from, to, "stage");
  }
}
