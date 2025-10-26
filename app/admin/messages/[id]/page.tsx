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
  response: z.string().optional()
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
  publicada?: boolean;
  createdAt?: string;
};

export default function EditMessagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [message, setMessage] = useState<MessageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      response: ''
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
        response: data.response ?? ''
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

  const formattedCreatedAt = useMemo(() => {
    if (!message?.createdAt) return null;
    const date = new Date(message.createdAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [message?.createdAt]);

  const onSubmit = async (values: FormValues) => {
    if (!message) return;

    const responseText = values.response?.trim() ?? '';

    try {
      const response = await fetch(`/api/messages/${message._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: responseText })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error((data as { error?: string } | null)?.error || 'Erro ao atualizar mensagem');
        return;
      }

      const updated = (await response.json()) as MessageDetails;
      setMessage(updated);
      form.reset({ response: updated.response ?? '' });
      toast.success('Mensagem salva');
    } catch (error) {
      console.error('Failed to update message', error);
      toast.error('Erro ao atualizar mensagem');
    }
  };

  const handlePublish = async () => {
    if (!message || message.publicada) return;
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/messages/${message._id}/publish`, { method: 'PATCH' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error((data as { error?: string } | null)?.error || 'Erro ao publicar mensagem');
        return;
      }
      const updated = (await response.json()) as MessageDetails;
      setMessage(updated);
      toast.success('Mensagem publicada');
    } catch (error) {
      console.error('Failed to publish message', error);
      toast.error('Erro ao publicar mensagem');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!message || !message.publicada) return;
    setIsUnpublishing(true);
    try {
      const response = await fetch(`/api/messages/${message._id}/unpublish`, { method: 'PATCH' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error((data as { error?: string } | null)?.error || 'Erro ao despublicar mensagem');
        return;
      }
      const updated = (await response.json()) as MessageDetails;
      setMessage(updated);
      toast.success('Mensagem despublicada');
    } catch (error) {
      console.error('Failed to unpublish message', error);
      toast.error('Erro ao despublicar mensagem');
    } finally {
      setIsUnpublishing(false);
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

  const statusBadge = message.publicada
    ? { label: 'Publicada', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' }
    : { label: 'Aguardando moderação', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Editar mensagem</h1>
          <p className="text-sm text-muted-foreground">Revise e modere as mensagens enviadas pelos fãs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!message.publicada && (
            <Button type="button" onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? 'Publicando...' : 'Publicar'}
            </Button>
          )}
          {message.publicada && (
            <Button type="button" variant="outline" onClick={handleUnpublish} disabled={isUnpublishing}>
              {isUnpublishing ? 'Despublicando...' : 'Despublicar'}
            </Button>
          )}
          <Button type="submit" form="message-form" disabled={form.formState.isSubmitting} variant="secondary">
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Excluindo...' : 'Deletar'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {formattedCreatedAt && <span>Recebida em {formattedCreatedAt}</span>}
        <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
      </div>

      <form id="message-form" className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={message.name} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={message.email} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={message.city ?? ''} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Input id="state" value={message.state ?? ''} readOnly disabled />
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea id="message" value={message.message} readOnly disabled rows={6} className="resize-none" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="response">Resposta</Label>
            <Textarea
              id="response"
              rows={6}
              {...form.register('response')}
              placeholder="Escreva uma resposta opcional para o fã"
            />
            {form.formState.errors.response && (
              <p className="text-sm text-destructive">{form.formState.errors.response.message}</p>
            )}
          </div>
        </section>
      </form>
    </div>
  );
}
