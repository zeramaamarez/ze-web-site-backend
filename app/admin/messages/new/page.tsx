'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { messageSchema } from '@/lib/validations/message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUpload, type UploadedImage } from '@/components/admin/image-upload';
import { toast } from 'sonner';

const formSchema = messageSchema.extend({
  published: z.boolean().optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function NewMessagePage() {
  const router = useRouter();
  const [cover, setCover] = useState<UploadedImage[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      excerpt: '',
      published: false
    }
  });

  const onSubmit = async (values: FormValues) => {
    const { published, ...rest } = values;
    const payload = {
      ...rest,
      cover: cover[0]?._id,
      published_at: published ? new Date().toISOString() : null
    };

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao criar mensagem');
      return;
    }

    toast.success('Mensagem criada com sucesso');
    router.push('/admin/messages');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova mensagem</h1>
        <p className="text-sm text-muted-foreground">Publique uma nova mensagem ou notícia.</p>
      </div>
      <form className="grid gap-6 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="excerpt">Resumo</Label>
            <Input id="excerpt" {...form.register('excerpt')} />
          </div>
          <div className="flex items-center gap-2">
            <input id="published" type="checkbox" {...form.register('published')} />
            <Label htmlFor="published">Publicado</Label>
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar mensagem'}
          </Button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Conteúdo *</Label>
            <RichTextEditor value={form.watch('content') || ''} onChange={(value) => form.setValue('content', value)} rows={12} />
            {form.formState.errors.content && <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Capa</Label>
            <ImageUpload value={cover} onChange={setCover} folder="messages" />
          </div>
        </div>
      </form>
    </div>
  );
}
