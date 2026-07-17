import { z } from "zod";
import { NotificationType, TaskStatus, FileType } from "@/generated/prisma/enums";

// Payload shapes are written by SECURITY DEFINER triggers, not application code - counterpart is
// supabase/sql/013_notification_triggers.sql. Every jsonb_build_object(...) there must produce
// exactly what the matching schema below parses; keep both in sync by hand if either changes.
//
// deadline_reminder is a real NotificationType value but has no producing trigger yet (PLAN.md
// P4.3, pg_cron) - deliberately given no payload shape here until that lands, since there is
// nothing yet to keep in sync with.

const taskAssignedPayloadSchema = z.object({
  taskId: z.string().uuid(),
  taskTitle: z.string(),
  assignedBy: z.string().uuid(),
});

// Shared by status_update and approval - approval is the specific case of a status change where
// newStatus = 'approval_sent', not a structurally different event, so it gets the same shape
// rather than a different field set invented for one status value.
const statusChangePayloadSchema = z.object({
  taskId: z.string().uuid(),
  taskTitle: z.string(),
  oldStatus: z.enum(TaskStatus),
  newStatus: z.enum(TaskStatus),
  changedBy: z.string().uuid(),
});

const fileUploadedPayloadSchema = z.object({
  taskId: z.string().uuid(),
  taskTitle: z.string(),
  uploadedBy: z.string().uuid(),
  fileType: z.enum(FileType),
});

// Validates a { type, payload } pair as read off an existing notifications row - this is what
// P4.2 (bell UI, not yet built) and this task's own acceptance test parse trigger-produced rows
// against.
export const notificationEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(NotificationType.task_assigned), payload: taskAssignedPayloadSchema }),
  z.object({ type: z.literal(NotificationType.status_update), payload: statusChangePayloadSchema }),
  z.object({ type: z.literal(NotificationType.approval), payload: statusChangePayloadSchema }),
  z.object({ type: z.literal(NotificationType.file_uploaded), payload: fileUploadedPayloadSchema }),
]);

// Full creation-input shape (userId + type + payload). Nothing in the app constructs this today -
// every notification row is written by the triggers above - kept for whatever future context
// needs to validate a notification before requesting one (none yet).
export const notificationCreateSchema = z.discriminatedUnion("type", [
  z.object({
    userId: z.string().uuid(),
    type: z.literal(NotificationType.task_assigned),
    payload: taskAssignedPayloadSchema,
  }),
  z.object({
    userId: z.string().uuid(),
    type: z.literal(NotificationType.status_update),
    payload: statusChangePayloadSchema,
  }),
  z.object({
    userId: z.string().uuid(),
    type: z.literal(NotificationType.approval),
    payload: statusChangePayloadSchema,
  }),
  z.object({
    userId: z.string().uuid(),
    type: z.literal(NotificationType.file_uploaded),
    payload: fileUploadedPayloadSchema,
  }),
]);

export type NotificationEvent = z.infer<typeof notificationEventSchema>;
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
