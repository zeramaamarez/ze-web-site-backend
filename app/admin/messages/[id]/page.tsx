'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const formSchema = z.object({
  response: z.string().optional(),
  private: z.boolean()
});

type FormValues = z.infer<typeof formSchema>;

type MessageDetails = {
  _id: string;
  name: string;
  email: string;
  city?: string | null;
  state?: string | null;
  message: string;
  response?: string | null;
  private?: boolean | null;
  published_at?: string | null;
  status?: 'draft' | 'published';
  createdAt?: string;
};

export default function EditMessagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [message, setMessage] = useState<MessageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      response: '',
      private: true
    }
  });

  const fetchMessage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/messages/${params.id}`);
      if (!response.ok) {
        toast.error('Mensagem não encontrada');
        router.push('/admin/messages');
        return;
      }
      const data = (await response.json()) as MessageDetails | null;
      if (!data) {
        toast.error('Mensagem não encontrada');
        router.push('/admin/messages');
        return;
      }
      setMessage(data);
      form.reset({
        response: data.response ?? '',
        private: data.private ?? !data.published_at
      });
    } catch (error) {
      console.error('Failed to load message', error);
      toast.error('Erro ao carregar mensagem');
      router.push('/admin/messages');
    } finally {
      setLoading(false);
    }
  }, [form, params.id, router]);

  useEffect(() => {
    void fetchMessage();
  }, [fetchMessage]);

  const isPrivate = form.watch('private');
  const persistedPrivate = message?.private ?? !message?.published_at;

  const formattedCreatedAt = useMemo(() => {
    if (!message?.createdAt) return null;
    const date = new Date(message.createdAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [message?.createdAt]);

  const onSubmit = async (values: FormValues) => {
    if (!message) return;

    const responseText = values.response?.trim() ?? '';

    const payload: Record<string, unknown> = {
      response: responseText,
      private: values.private
    };

    if (!values.private) {
      const publishedAt = message.published_at ? new Date(message.published_at) : new Date();
      payload.published_at = publishedAt.toISOString();
    } else {
      payload.published_at = null;
    }

    try {
      const response = await fetch(`/api/messages/${message._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error((data as { error?: string } | null)?.error || 'Erro ao atualizar mensagem');
        return;
      }

      const updated = (await response.json()) as MessageDetails;
      setMessage(updated);
      form.reset({
        response: updated.response ?? '',
        private: updated.private ?? !updated.published_at
      });
      toast.success('Mensagem atualizada');
    } catch (error) {
      console.error('Failed to update message', error);
      toast.error('Erro ao atualizar mensagem');
    }
  };

  const handlePublish = async () => {
    if (!message || !isPrivate) return;
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/messages/${message._id}/publish`, { method: 'PATCH' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error((data as { error?: string } | null)?.error || 'Erro ao publicar mensagem');
        return;
      }
      const data = (await response.json()) as { published_at?: string | null; private?: boolean | null; status?: string | null };
      const publishedAt = data.published_at ?? new Date().toISOString();
      setMessage((current) =>
        current
          ? {
              ...current,
              private: data.private ?? false,
              published_at: publishedAt,
              status: (data.status as MessageDetails['status']) ?? 'published'
            }
          : current
      );
      form.setValue('private', false);
      toast.success('Mensagem publicada');
    } catch (error) {
      console.error('Failed to publish message', error);
      toast.error('Erro ao publicar mensagem');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!message) return;
    if (!confirm('Deseja realmente deletar esta mensagem?')) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/messages/${message._id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error((data as { error?: string } | null)?.error || 'Erro ao deletar mensagem');
        return;
      }
      toast.success('Mensagem deletada');
      router.push('/admin/messages');
    } catch (error) {
      console.error('Failed to delete message', error);
      toast.error('Erro ao deletar mensagem');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!message) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Editar mensagem</h1>
          <p className="text-sm text-muted-foreground">Revise e modere as mensagens enviadas pelos fãs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handlePublish} disabled={isPublishing || !isPrivate}>
            {isPublishing ? 'Publicando...' : 'Publish'}
          </Button>
          <Button type="submit" form="message-form" disabled={form.formState.isSubmitting} variant="secondary">
            {form.formState.isSubmitting ? 'Salvando...' : 'Save'}
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Excluindo...' : 'Delete this entry'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {formattedCreatedAt && <span>Recebida em {formattedCreatedAt}</span>}
        <Badge className={persistedPrivate ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' : 'bg-green-100 text-green-700 hover:bg-green-100'}>
          {persistedPrivate ? 'Draft' : 'Published'}
        </Badge>
      </div>

      <form id="message-form" className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={message.name} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={message.email} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={message.city ?? ''} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" value={message.state ?? ''} readOnly disabled />
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" value={message.message} readOnly disabled rows={6} className="resize-none" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="response">Response</Label>
            <Textarea id="response" rows={6} {...form.register('response')} placeholder="Escreva uma resposta opcional para o fã" />
            {form.formState.errors.response && (
              <p className="text-sm text-destructive">{form.formState.errors.response.message}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input id="private" type="checkbox" className="h-4 w-4" {...form.register('private')} />
            <Label htmlFor="private" className="text-sm font-medium">
              Private
            </Label>
          </div>
        </section>
      </form>
    </div>
  );
}
