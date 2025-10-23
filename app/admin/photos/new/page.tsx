'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

export default function NewPhotoPage() {
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>([]);

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

  const onSubmit = async (values: FormValues) => {
    const { published, ...rest } = values;
    const payload = {
      ...rest,
      images: images.map((image) => image._id),
      published_at: published ? new Date().toISOString() : null
    };

    const response = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao criar galeria');
      return;
    }

    toast.success('Galeria criada com sucesso');
    router.push('/admin/photos');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova galeria</h1>
        <p className="text-sm text-muted-foreground">Cadastre uma nova galeria de fotos.</p>
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
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar galeria'}
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
            {form.formState.errors.images && <p className="text-sm text-destructive">{form.formState.errors.images.message}</p>}
          </div>
        </div>
      </form>
    </div>
  );
}
