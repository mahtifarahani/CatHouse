import { z } from "zod";

export const CatalogRungSchema = z.object({
  rung: z.string(),
  enabled: z.boolean(),
  why: z.string().optional(),
  scored: z.boolean(),
  treatLike: z.string().nullable(),
  costTier: z.number().optional(),
  costMode: z.string().optional(),
});
export type CatalogRung = z.infer<typeof CatalogRungSchema>;

export const CatalogModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  backend: z.string(),
  model: z.string(),
  roles: z.array(z.string()),
  listed: z.boolean().nullable(),
  notes: z.string().optional(),
  rungs: z.array(CatalogRungSchema),
});
export type CatalogModel = z.infer<typeof CatalogModelSchema>;

export const CatalogResultSchema = z.object({
  total: z.number(),
  models: z.array(CatalogModelSchema),
});
