import { z } from 'zod';

const youtubeRegex = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}(&.+)?$/i;

export const clipSchema = z.object({
  title: z.string().min(1),
  info: z.string().optional(),
  url: z.string().url('URL inválida').regex(youtubeRegex, 'Informe uma URL do YouTube'),
  cover: z.array(z.string()).optional(),
  published_at: z.coerce.date().nullable().optional()
});

export type ClipInput = z.infer<typeof clipSchema>;
