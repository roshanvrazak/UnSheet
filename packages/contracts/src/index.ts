import { z } from 'zod';

export const VersionSchema = z.object({
  version: z.string().min(1),
  name: z.string().min(1)
});

export type Version = z.infer<typeof VersionSchema>;
