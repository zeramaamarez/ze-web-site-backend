import { z } from 'zod';

export const bookSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  author: z.string().optional(),
  info: z.string().optional(),
  publishing_company: z.string().optional(),
  release_date: z.string().optional(),
  ISBN: z.string().optional(),
  cover: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  published_at: z.coerce.date().nullable().optional()
});

export type BookInput = z.infer<typeof bookSchema>;
