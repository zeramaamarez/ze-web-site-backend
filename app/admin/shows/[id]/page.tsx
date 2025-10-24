'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { showSchema } from '@/lib/validations/show';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUpload, type UploadedImage } from '@/components/admin/image-upload';
import { toast } from 'sonner';

const formSchema = showSchema.extend({
  published: z.boolean().optional()
});

type FormValues = z.infer<typeof formSchema> & { ticket_url?: string };

export default function EditShowPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [banner, setBanner] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      date: '',
      time: '',
      venue: '',
      city: '',
      state: '',
      country: '',
      address: '',
      ticket_url: '',
      description: '',
      published: false
    }
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/shows/${params.id}`);
      if (!response.ok) {
        toast.error('Show não encontrado');
        router.push('/admin/shows');
        return;
      }

      const data = await response.json();
      form.reset({
        title: data.title || '',
        date: data.date ? new Date(data.date).toISOString().split('T')[0] : '',
        time: data.time || '',
        venue: data.venue || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || '',
        address: data.address || '',
        ticket_url: data.ticket_url || '',
        description: data.description || '',
        published: Boolean(data.published_at)
      });
      const image = data.banner ?? data.cover;
      if (image) {
        setBanner([{ _id: image._id, url: image.url, name: image.name }]);
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const onSubmit = async (values: FormValues) => {
    const { published, ticket_url, ...rest } = values;
    const payload = {
      ...rest,
      ticket_url: ticket_url ? ticket_url : undefined,
      banner: banner[0]?._id ?? null,
      published_at: published ? new Date().toISOString() : null
    };

    const response = await fetch(`/api/shows/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao atualizar show');
      return;
    }

    toast.success('Show atualizado');
    router.push('/admin/shows');
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar show</h1>
        <p className="text-sm text-muted-foreground">Atualize os detalhes do show.</p>
      </div>
      <form className="grid gap-6 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Data *</Label>
            <Input id="date" type="date" {...form.register('date')} />
            {form.formState.errors.date && <p className="text-sm text-destructive">Data inválida</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Horário</Label>
            <Input id="time" {...form.register('time')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue">Local *</Label>
            <Input id="venue" {...form.register('venue')} />
            {form.formState.errors.venue && <p className="text-sm text-destructive">{form.formState.errors.venue.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade *</Label>
            <Input id="city" {...form.register('city')} />
            {form.formState.errors.city && <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Input id="state" {...form.register('state')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">País</Label>
            <Input id="country" {...form.register('country')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" {...form.register('address')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket_url">Link de ingressos</Label>
            <Input id="ticket_url" {...form.register('ticket_url')} />
            {form.formState.errors.ticket_url && <p className="text-sm text-destructive">{form.formState.errors.ticket_url.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <input id="published" type="checkbox" {...form.register('published')} />
            <Label htmlFor="published">Publicado</Label>
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <RichTextEditor value={form.watch('description') || ''} onChange={(value) => form.setValue('description', value)} rows={10} />
          </div>
          <div className="space-y-2">
            <Label>Banner</Label>
            <ImageUpload value={banner} onChange={setBanner} folder="shows" />
          </div>
        </div>
      </form>
    </div>
  );
}
