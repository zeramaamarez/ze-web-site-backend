import { z } from 'zod';

export const showSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  date: z.coerce.date({ invalid_type_error: 'Data inválida' }),
  time: z.string().optional(),
  venue: z.string().min(1, 'Local é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  ticket_url: z
    .string()
    .url('Informe uma URL válida')
    .optional(),
  description: z.string().optional(),
  cover: z.string().nullable().optional(),
  published_at: z.coerce.date().nullable().optional()
});

export type ShowInput = z.infer<typeof showSchema>;
