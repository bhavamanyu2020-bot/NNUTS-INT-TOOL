import { z } from "zod";
import { NotificationType } from "@/generated/prisma/enums";

// Delivery is out of scope for this phase; this shape exists because the table is scaffolded.
export const notificationCreateSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(NotificationType),
  payload: z.record(z.string(), z.unknown()),
});

export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
