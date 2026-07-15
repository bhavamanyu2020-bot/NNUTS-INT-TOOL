import { z } from "zod";
import { FileType } from "@/generated/prisma/enums";

export const taskFileCreateSchema = z.object({
  taskId: z.string().uuid(),
  driveLink: z.string().url(),
  fileType: z.enum(FileType),
});

export type TaskFileCreateInput = z.infer<typeof taskFileCreateSchema>;
