import { z } from "zod";
import { Role } from "@/generated/prisma/enums";

export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(Role),
  teamId: z.string().uuid().nullable().default(null),
  leadId: z.string().uuid().nullable().default(null),
});

export const userUpdateSchema = userCreateSchema.partial();

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
