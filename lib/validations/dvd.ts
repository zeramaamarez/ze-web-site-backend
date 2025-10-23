import { z } from 'zod';

export const dvdTrackSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  composers: z.string().optional(),
  time: z.string().optional(),
  lyric: z.string().optional()
});

const vimeoRegex = /^(https?:\/\/)?(www\.|player\.)?vimeo\.com\/(\d+|video\/\d+|channels\/.+\/\d+|groups\/.+\/videos\/\d+)/i;

export const dvdSchema = z.object({
  title: z.string().min(1),
  company: z.string().optional(),
  release_date: z.string().optional(),
  info: z.string().optional(),
  videoUrl: z.string().url('URL inválida').regex(vimeoRegex, 'Informe uma URL do Vimeo'),
  cover: z.string().optional(),
  published_at: z.coerce.date().nullable().optional(),
  tracks: z.array(dvdTrackSchema).optional()
});

export type DvdInput = z.infer<typeof dvdSchema>;
export type DvdTrackInput = z.infer<typeof dvdTrackSchema>;
