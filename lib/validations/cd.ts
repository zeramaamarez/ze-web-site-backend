import { z } from 'zod';

export const cdTrackSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  composers: z.string().optional()
});

export const cdSchema = z.object({
  title: z.string().min(1),
  company: z.string().optional(),
  release_date: z.string().optional(),
  info: z.string().optional(),
  cover: z.string().optional(),
  published_at: z.coerce.date().nullable().optional(),
  tracks: z.array(cdTrackSchema).optional()
});

export type CdInput = z.infer<typeof cdSchema>;
export type CdTrackInput = z.infer<typeof cdTrackSchema>;
