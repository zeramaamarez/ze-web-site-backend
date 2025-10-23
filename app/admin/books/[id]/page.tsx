'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { bookSchema } from '@/lib/validations/book';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUpload, type UploadedImage } from '@/components/admin/image-upload';
import { toast } from 'sonner';

const formSchema = bookSchema.extend({
  published: z.boolean().optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function EditBookPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [cover, setCover] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      author: '',
      info: '',
      publishing_company: '',
      release_date: '',
      ISBN: '',
      published: false
    }
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/books/${params.id}`);
      if (!response.ok) {
        toast.error('Livro não encontrado');
        router.push('/admin/books');
        return;
      }

      const data = await response.json();
      form.reset({
        title: data.title || '',
        author: data.author || '',
        info: data.info || '',
        publishing_company: data.publishing_company || '',
        release_date: data.release_date || '',
        ISBN: data.ISBN || '',
        published: Boolean(data.published_at)
      });
      if (data.cover) {
        setCover([{ _id: data.cover._id, url: data.cover.url, name: data.cover.name }]);
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const onSubmit = async (values: FormValues) => {
    const { published, ...rest } = values;
    const payload = {
      ...rest,
      published_at: published ? new Date().toISOString() : null,
      cover: cover[0]?._id
    };

    const response = await fetch(`/api/books/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao atualizar livro');
      return;
    }

    toast.success('Livro atualizado');
    router.push('/admin/books');
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar livro</h1>
        <p className="text-sm text-muted-foreground">Atualize os dados do livro.</p>
      </div>
      <form className="grid gap-6 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="author">Autor</Label>
            <Input id="author" {...form.register('author')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publishing_company">Editora</Label>
            <Input id="publishing_company" {...form.register('publishing_company')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="release_date">Data de lançamento</Label>
            <Input id="release_date" {...form.register('release_date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ISBN">ISBN</Label>
            <Input id="ISBN" {...form.register('ISBN')} />
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
            <Label>Resumo</Label>
            <RichTextEditor value={form.watch('info') || ''} onChange={(value) => form.setValue('info', value)} />
          </div>
          <div className="space-y-2">
            <Label>Capa</Label>
            <ImageUpload value={cover} onChange={setCover} folder="books" />
          </div>
        </div>
      </form>
    </div>
  );
}
