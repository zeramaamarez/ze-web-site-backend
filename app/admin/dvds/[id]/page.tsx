'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { dvdSchema, dvdTrackSchema } from '@/lib/validations/dvd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUpload, type UploadedImage } from '@/components/admin/image-upload';
import { toast } from 'sonner';

const formSchema = dvdSchema.extend({
  published: z.boolean().optional(),
  tracks: z.array(dvdTrackSchema).optional()
});

type TrackForm = z.infer<typeof dvdTrackSchema>;
type FormValues = z.infer<typeof formSchema>;

export default function EditDvdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [cover, setCover] = useState<UploadedImage[]>([]);
  const [tracks, setTracks] = useState<TrackForm[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      company: '',
      release_date: '',
      info: '',
      videoUrl: '',
      published: false
    }
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/dvds/${params.id}`);
      if (!response.ok) {
        toast.error('DVD não encontrado');
        router.push('/admin/dvds');
        return;
      }

      const data = await response.json();
      form.reset({
        title: data.title || '',
        company: data.company || '',
        release_date: data.release_date || '',
        info: data.info || '',
        videoUrl: data.videoUrl || '',
        published: Boolean(data.published_at)
      });
      if (data.cover) {
        setCover([{ _id: data.cover._id, url: data.cover.url, name: data.cover.name }]);
      }
      if (Array.isArray(data.track)) {
        setTracks(
          data.track.map(
            (item: {
              ref?: {
                _id: string;
                name: string;
                composers?: string;
                publishing_company?: string;
                time?: string;
                lyric?: string;
              };
            }) => ({
              _id: item.ref?._id,
              name: item.ref?.name || '',
              composers: item.ref?.composers || '',
              publishing_company: item.ref?.publishing_company || '',
              time: item.ref?.time || '',
              lyric: item.ref?.lyric || ''
            })
          )
        );
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const addTrack = () => {
    setTracks((prev) => [...prev, { name: '', composers: '', publishing_company: '', time: '', lyric: '' }]);
  };

  const updateTrack = (index: number, key: keyof TrackForm, value: string) => {
    setTracks((prev) => prev.map((track, i) => (i === index ? { ...track, [key]: value } : track)));
  };

  const removeTrack = (index: number) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: FormValues) => {
    const { published, ...rest } = values;
    const payload = {
      ...rest,
      tracks,
      published_at: published ? new Date().toISOString() : null,
      cover: cover[0]?._id
    };

    const response = await fetch(`/api/dvds/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao atualizar DVD');
      return;
    }

    toast.success('DVD atualizado');
    router.push('/admin/dvds');
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar DVD</h1>
        <p className="text-sm text-muted-foreground">Atualize os dados do DVD.</p>
      </div>
      <form className="grid gap-6 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Produtora</Label>
            <Input id="company" {...form.register('company')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="release_date">Data de lançamento</Label>
            <Input id="release_date" {...form.register('release_date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="videoUrl">URL do Vimeo</Label>
            <Input id="videoUrl" {...form.register('videoUrl')} />
            {form.formState.errors.videoUrl && <p className="text-sm text-destructive">{form.formState.errors.videoUrl.message}</p>}
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
            <Label>Informações</Label>
            <RichTextEditor value={form.watch('info') || ''} onChange={(value) => form.setValue('info', value)} />
          </div>
          <div className="space-y-2">
            <Label>Capa</Label>
            <ImageUpload value={cover} onChange={setCover} folder="dvds" />
          </div>
        </div>
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Faixas</h2>
            <Button type="button" variant="outline" onClick={addTrack}>
              Adicionar faixa
            </Button>
          </div>
          {tracks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma faixa adicionada.</p>}
          <div className="space-y-4">
            {tracks.map((track, index) => (
              <div key={track._id ?? index} className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Faixa {index + 1}</h3>
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeTrack(index)}>
                    Remover
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={track.name} onChange={(event) => updateTrack(index, 'name', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Compositores</Label>
                    <Input value={track.composers || ''} onChange={(event) => updateTrack(index, 'composers', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Gravadora</Label>
                    <Input
                      value={track.publishing_company || ''}
                      onChange={(event) => updateTrack(index, 'publishing_company', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Input value={track.time || ''} onChange={(event) => updateTrack(index, 'time', event.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Letra</Label>
                    <RichTextEditor value={track.lyric || ''} onChange={(value) => updateTrack(index, 'lyric', value)} rows={4} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
