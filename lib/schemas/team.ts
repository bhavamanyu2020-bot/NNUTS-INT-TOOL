import { z } from "zod";

export const teamCreateSchema = z.object({
  name: z.string().min(1),
  leadId: z.string().uuid().nullable().default(null),
});

export const teamUpdateSchema = teamCreateSchema.partial();

export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;
