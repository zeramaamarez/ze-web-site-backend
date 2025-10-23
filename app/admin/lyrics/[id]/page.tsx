'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { lyricSchema } from '@/lib/validations/lyric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { toast } from 'sonner';

const formSchema = lyricSchema.extend({
  published: z.boolean().optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function EditLyricPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      lyric: '',
      composers: '',
      album: '',
      year: '',
      published: false
    }
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/lyrics/${params.id}`);
      if (!response.ok) {
        toast.error('Letra não encontrada');
        router.push('/admin/lyrics');
        return;
      }

      const data = await response.json();
      form.reset({
        title: data.title || '',
        lyric: data.lyric || '',
        composers: data.composers || '',
        album: data.album || '',
        year: data.year || '',
        published: Boolean(data.published_at)
      });
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const onSubmit = async (values: FormValues) => {
    const { published, ...rest } = values;
    const payload = {
      ...rest,
      published_at: published ? new Date().toISOString() : null
    };

    const response = await fetch(`/api/lyrics/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao atualizar letra');
      return;
    }

    toast.success('Letra atualizada');
    router.push('/admin/lyrics');
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar letra</h1>
        <p className="text-sm text-muted-foreground">Atualize as informações da letra.</p>
      </div>
      <form className="grid gap-6 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="composers">Compositores</Label>
            <Input id="composers" {...form.register('composers')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="album">Álbum</Label>
            <Input id="album" {...form.register('album')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Ano</Label>
            <Input id="year" {...form.register('year')} />
          </div>
          <div className="flex items-center gap-2">
            <input id="published" type="checkbox" {...form.register('published')} />
            <Label htmlFor="published">Publicado</Label>
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
        <div className="space-y-4 md:col-span-2">
          <div className="space-y-2">
            <Label>Letra</Label>
            <RichTextEditor value={form.watch('lyric') || ''} onChange={(value) => form.setValue('lyric', value)} rows={10} />
          </div>
        </div>
      </form>
    </div>
  );
}
