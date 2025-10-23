'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function NewBookPage() {
  const router = useRouter();
  const [cover, setCover] = useState<UploadedImage[]>([]);

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

  const onSubmit = async (values: FormValues) => {
    const { published, ...rest } = values;
    const payload = {
      ...rest,
      published_at: published ? new Date().toISOString() : null,
      cover: cover[0]?._id
    };

    const response = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao criar livro');
      return;
    }

    toast.success('Livro criado com sucesso');
    router.push('/admin/books');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo livro</h1>
        <p className="text-sm text-muted-foreground">Cadastre um novo livro do catálogo.</p>
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
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar livro'}
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
