'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

export default function NewShowPage() {
  const router = useRouter();
  const [banner, setBanner] = useState<UploadedImage[]>([]);

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

  const onSubmit = async (values: FormValues) => {
    const { published, ticket_url, ...rest } = values;
    const payload = {
      ...rest,
      ticket_url: ticket_url ? ticket_url : undefined,
      banner: banner[0]?._id ?? null,
      published_at: published ? new Date().toISOString() : null
    };

    const response = await fetch('/api/shows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao criar show');
      return;
    }

    toast.success('Show criado com sucesso');
    router.push('/admin/shows');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo show</h1>
        <p className="text-sm text-muted-foreground">Cadastre um novo show ou evento.</p>
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
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar show'}
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
