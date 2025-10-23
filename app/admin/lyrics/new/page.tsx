'use client';

import { useRouter } from 'next/navigation';
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

export default function NewLyricPage() {
  const router = useRouter();
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

  const onSubmit = async (values: FormValues) => {
    const { published, ...rest } = values;
    const payload = {
      ...rest,
      published_at: published ? new Date().toISOString() : null
    };

    const response = await fetch('/api/lyrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao criar letra');
      return;
    }

    toast.success('Letra criada com sucesso');
    router.push('/admin/lyrics');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova letra</h1>
        <p className="text-sm text-muted-foreground">Cadastre uma nova letra de música.</p>
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
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar letra'}
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
