import { z } from 'zod';

export const lyricSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  lyric: z.string().optional(),
  composers: z.string().optional(),
  album: z.string().optional(),
  year: z.string().optional(),
  published_at: z.coerce.date().nullable().optional()
});

export type LyricInput = z.infer<typeof lyricSchema>;
