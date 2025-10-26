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
  city: z.string().optional(),
  state: z.string().optional(),
  message: z.string().min(1, 'Mensagem é obrigatória'),
  response: z.string().optional(),
  private: z.boolean()
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
      response: '',
      private: true
    }
  });

  const onSubmit = async (values: FormValues) => {
    const responseText = values.response?.trim() ?? '';
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      email: values.email.trim(),
      city: values.city?.trim() || undefined,
      state: values.state?.trim() || undefined,
      message: values.message.trim(),
      response: responseText,
      private: values.private
    };

    if (!values.private) {
      payload.published_at = new Date().toISOString();
    }

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
          Crie manualmente uma mensagem de fã ou registre respostas recebidas fora do formulário público.
        </p>
      </div>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...form.register('name')} placeholder="Nome do fã" />
            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" {...form.register('email')} placeholder="email@exemplo.com" />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...form.register('city')} placeholder="Cidade" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" {...form.register('state')} placeholder="Estado" />
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea id="message" rows={6} {...form.register('message')} placeholder="Mensagem do fã" />
            {form.formState.errors.message && <p className="text-sm text-destructive">{form.formState.errors.message.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="response">Response</Label>
            <Textarea id="response" rows={6} {...form.register('response')} placeholder="Resposta opcional do moderador" />
          </div>
          <div className="flex items-center gap-2">
            <input id="private" type="checkbox" className="h-4 w-4" {...form.register('private')} />
            <Label htmlFor="private" className="text-sm font-medium">
              Private
            </Label>
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
