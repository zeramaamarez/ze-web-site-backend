'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

export default function EditClipPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      info: '',
      url: '',
      published: false
    }
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/clips/${params.id}`);
      if (!response.ok) {
        toast.error('Clip não encontrado');
        router.push('/admin/clips');
        return;
      }

      const data = await response.json();
      form.reset({
        title: data.title || '',
        info: data.info || '',
        url: data.url || '',
        published: Boolean(data.published_at)
      });
      if (Array.isArray(data.cover)) {
        setImages(data.cover.map((item: { _id: string; url: string; name?: string }) => ({ _id: item._id, url: item.url, name: item.name })));
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
      cover: images.map((image) => image._id)
    };

    const response = await fetch(`/api/clips/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao atualizar clip');
      return;
    }

    toast.success('Clip atualizado');
    router.push('/admin/clips');
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar clip</h1>
        <p className="text-sm text-muted-foreground">Atualize os dados do vídeo.</p>
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
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar alterações'}
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
