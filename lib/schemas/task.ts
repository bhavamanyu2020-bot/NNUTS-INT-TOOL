import { z } from "zod";
import { ServiceType, TaskStage, TaskStatus } from "@/generated/prisma/enums";

export const taskCreateSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  assignedTo: z.string().uuid().nullable().default(null),
  serviceType: z.enum(ServiceType),
  deadline: z.coerce.date().nullable().default(null),
});

// Non-lifecycle fields only - status/stage are changed through their own narrow schemas below
// so the FSM-guard call site is unambiguous.
export const taskUpdateSchema = taskCreateSchema
  .omit({ clientId: true })
  .partial();

export const taskAssignSchema = z.object({
  taskId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
});

export const taskStatusChangeSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(TaskStatus),
});

export const taskStageChangeSchema = z.object({
  taskId: z.string().uuid(),
  stage: z.enum(TaskStage),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskAssignInput = z.infer<typeof taskAssignSchema>;
export type TaskStatusChangeInput = z.infer<typeof taskStatusChangeSchema>;
export type TaskStageChangeInput = z.infer<typeof taskStageChangeSchema>;
