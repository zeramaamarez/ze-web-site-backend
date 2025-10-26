import { z } from 'zod';

export const messageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  message: z.string().min(1, 'Mensagem é obrigatória'),
  response: z.string().optional().nullable(),
  private: z.boolean().optional(),
  status: z.enum(['draft', 'published']).optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  published_at: z.coerce.date().nullable().optional()
});

export type MessageInput = z.infer<typeof messageSchema>;
