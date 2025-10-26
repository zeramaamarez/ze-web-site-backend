import { z } from 'zod';

export const messageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().min(1, 'Estado é obrigatório'),
  message: z.string().min(1, 'Mensagem é obrigatória'),
  response: z.string().optional().nullable(),
  publicada: z.boolean().optional()
});

export type MessageInput = z.infer<typeof messageSchema>;
