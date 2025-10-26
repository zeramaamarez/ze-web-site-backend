'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().min(1, 'Estado é obrigatório'),
  message: z.string().min(1, 'Mensagem é obrigatória'),
  response: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function NewMessagePage() {
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      city: '',
      state: '',
      message: '',
      response: ''
    }
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      message: values.message.trim(),
      response: values.response?.trim() ?? '',
      published: false
    } as const;

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error((data as { error?: string } | null)?.error || 'Erro ao criar mensagem');
        return;
      }

      toast.success('Mensagem criada com sucesso');
      router.push('/admin/messages');
    } catch (error) {
      console.error('Failed to create message', error);
      toast.error('Erro ao criar mensagem');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Nova mensagem</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre manualmente uma mensagem recebida fora do formulário público.
        </p>
      </div>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...form.register('name')} placeholder="Nome do fã" />
            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" {...form.register('email')} placeholder="email@exemplo.com" />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade *</Label>
            <Input id="city" {...form.register('city')} placeholder="Cidade" />
            {form.formState.errors.city && <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado *</Label>
            <Input id="state" {...form.register('state')} placeholder="Estado/UF" />
            {form.formState.errors.state && <p className="text-sm text-destructive">{form.formState.errors.state.message}</p>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea id="message" rows={6} {...form.register('message')} placeholder="Mensagem do fã" />
            {form.formState.errors.message && (
              <p className="text-sm text-destructive">{form.formState.errors.message.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="response">Resposta</Label>
            <Textarea id="response" rows={6} {...form.register('response')} placeholder="Resposta opcional do moderador" />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar mensagem'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/messages')}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
