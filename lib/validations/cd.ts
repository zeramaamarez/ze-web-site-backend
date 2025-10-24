import { z } from 'zod';

export const cdTrackSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  publishing_company: z.string().optional(),
  composers: z.string().optional(),
  time: z.string().optional(),
  track: z.string().optional().nullable(),
  lyric: z.string().optional(),
  data_sheet: z.string().optional()
});

export const cdSchema = z.object({
  title: z.string().min(1),
  company: z.string().optional(),
  release_date: z.string().optional(),
  info: z.string().optional(),
  cover: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  published_at: z.coerce.date().nullable().optional(),
  tracks: z.array(cdTrackSchema).optional()
});

export type CdInput = z.infer<typeof cdSchema>;
export type CdTrackInput = z.infer<typeof cdTrackSchema>;
