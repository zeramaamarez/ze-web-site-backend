import { z } from 'zod';

const vimeoRegex = /^(https?:\/\/)?(www\.|player\.)?vimeo\.com\/(\d+|video\/\d+|channels\/.+\/\d+|groups\/.+\/videos\/\d+)/i;
const youtubeEmbedRegex = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/embed\/|youtu\.be\/)[\w-]+/i;

export const dvdTrackSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  composers: z.string().optional(),
  label: z.string().optional(),
  time: z.string().optional(),
  lyric: z.string().optional(),
  track: z.string().optional().nullable()
});

export const dvdSchema = z.object({
  title: z.string().min(1),
  company: z.string().optional(),
  release_date: z.string().optional(),
  info: z.string().optional(),
  videoUrl: z
    .string()
    .url('URL inválida')
    .refine((value) => vimeoRegex.test(value) || youtubeEmbedRegex.test(value), 'Informe uma URL do Vimeo ou YouTube'),
  cover: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  published_at: z.coerce.date().nullable().optional(),
  tracks: z.array(dvdTrackSchema).optional()
});

export type DvdInput = z.infer<typeof dvdSchema>;
export type DvdTrackInput = z.infer<typeof dvdTrackSchema>;
