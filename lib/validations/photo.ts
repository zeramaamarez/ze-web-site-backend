import { z } from 'zod';

export const photoSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  info: z.string().optional(),
  url: z.array(z.string().min(1)).optional(),
  images: z.array(z.string().min(1)).optional(),
  release_date: z.string().optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  published_at: z.coerce.date().nullable().optional()
});

export type PhotoInput = z.infer<typeof photoSchema>;
