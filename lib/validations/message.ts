import { z } from 'zod';

export const messageSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  content: z.string().min(1, 'Conteúdo é obrigatório'),
  excerpt: z.string().optional(),
  cover: z.string().nullable().optional(),
  published_at: z.coerce.date().nullable().optional()
});

export type MessageInput = z.infer<typeof messageSchema>;
