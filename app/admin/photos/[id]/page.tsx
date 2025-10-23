'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { photoSchema } from '@/lib/validations/photo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUpload, type UploadedImage } from '@/components/admin/image-upload';
import { toast } from 'sonner';

const formSchema = photoSchema.extend({
  published: z.boolean().optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function EditPhotoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      location: '',
      published: false
    }
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/photos/${params.id}`);
      if (!response.ok) {
        toast.error('Galeria não encontrada');
        router.push('/admin/photos');
        return;
      }

      const data = await response.json();
      form.reset({
        title: data.title || '',
        description: data.description || '',
        date: data.date || '',
        location: data.location || '',
        published: Boolean(data.published_at)
      });
      if (Array.isArray(data.images)) {
        setImages(
          data.images.map((image: { _id: string; url: string; name?: string }) => ({
            _id: image._id,
            url: image.url,
            name: image.name
          }))
        );
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
      images: images.map((image) => image._id),
      published_at: published ? new Date().toISOString() : null
    };

    const response = await fetch(`/api/photos/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao atualizar galeria');
      return;
    }

    toast.success('Galeria atualizada');
    router.push('/admin/photos');
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar galeria</h1>
        <p className="text-sm text-muted-foreground">Atualize as informações da galeria.</p>
      </div>
      <form className="grid gap-6 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input id="date" {...form.register('date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Local</Label>
            <Input id="location" {...form.register('location')} />
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
            <Label>Descrição</Label>
            <RichTextEditor value={form.watch('description') || ''} onChange={(value) => form.setValue('description', value)} rows={8} />
          </div>
          <div className="space-y-2">
            <Label>Imagens</Label>
            <ImageUpload value={images} onChange={setImages} multiple folder="photos" />
          </div>
        </div>
      </form>
    </div>
  );
}
