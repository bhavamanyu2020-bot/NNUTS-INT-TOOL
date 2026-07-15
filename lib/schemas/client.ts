import { z } from "zod";
import { ServiceType } from "@/generated/prisma/enums";

export const clientCreateSchema = z.object({
  brandName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().nullable().default(null),
  package: z.string().min(1),
  serviceType: z.enum(ServiceType),
  documentsLink: z.string().url().nullable().default(null),
  driveFolderLink: z.string().url().nullable().default(null),
  timeline: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
