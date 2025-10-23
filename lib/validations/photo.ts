import { z } from 'zod';

export const photoSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  images: z.array(z.string()).optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  published_at: z.coerce.date().nullable().optional()
});

export type PhotoInput = z.infer<typeof photoSchema>;
