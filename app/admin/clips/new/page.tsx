'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { clipSchema } from '@/lib/validations/clip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUpload, type UploadedImage } from '@/components/admin/image-upload';
import { toast } from 'sonner';

const formSchema = clipSchema.extend({
  published: z.boolean().optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function NewClipPage() {
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      info: '',
      url: '',
      published: false
    }
  });

  const onSubmit = async (values: FormValues) => {
    const { published, ...rest } = values;
    const payload = {
      ...rest,
      published_at: published ? new Date().toISOString() : null,
      cover: images.map((image) => image._id)
    };

    const response = await fetch('/api/clips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao criar clip');
      return;
    }

    toast.success('Clip criado com sucesso');
    router.push('/admin/clips');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo clip</h1>
        <p className="text-sm text-muted-foreground">Cadastre um novo vídeo.</p>
      </div>
      <form className="grid gap-6 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">URL do YouTube *</Label>
            <Input id="url" {...form.register('url')} />
            {form.formState.errors.url && <p className="text-sm text-destructive">{form.formState.errors.url.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <input id="published" type="checkbox" {...form.register('published')} />
            <Label htmlFor="published">Publicado</Label>
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar clip'}
          </Button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <RichTextEditor value={form.watch('info') || ''} onChange={(value) => form.setValue('info', value)} />
          </div>
          <div className="space-y-2">
            <Label>Galeria</Label>
            <ImageUpload value={images} onChange={setImages} folder="clips" multiple />
          </div>
        </div>
      </form>
    </div>
  );
}
