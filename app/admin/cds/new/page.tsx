'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cdSchema, cdTrackSchema } from '@/lib/validations/cd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUpload, type UploadedImage } from '@/components/admin/image-upload';
import { AudioUpload, type UploadedAudio } from '@/components/admin/audio-upload';
import { toast } from 'sonner';

const formSchema = cdSchema.extend({
  published: z.boolean().optional(),
  tracks: z.array(cdTrackSchema.omit({ _id: true })).optional()
});

type TrackForm = z.infer<typeof cdTrackSchema.omit({ _id: true })> & {
  audioFile?: UploadedAudio | null;
};
type FormValues = z.infer<typeof formSchema>;

export default function NewCdPage() {
  const router = useRouter();
  const [cover, setCover] = useState<UploadedImage[]>([]);
  const [tracks, setTracks] = useState<TrackForm[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      company: '',
      release_date: '',
      info: '',
      published: false
    }
  });

  const addTrack = () => {
    setTracks((prev) => [
      ...prev,
      { name: '', publishing_company: '', composers: '', time: '', track: undefined, lyric: '', data_sheet: '', audioFile: null }
    ]);
  };

  const updateTrack = <K extends keyof TrackForm>(index: number, key: K, value: TrackForm[K]) => {
    setTracks((prev) => prev.map((track, i) => (i === index ? { ...track, [key]: value } : track)));
  };

  const removeTrack = (index: number) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: FormValues) => {
    const { published, ...rest } = values;
    const payload = {
      ...rest,
      tracks: tracks.map(({ audioFile: _audioFile, ...rest }) => ({
        ...rest,
        track: rest.track || undefined
      })),
      published_at: published ? new Date().toISOString() : null,
      cover: cover[0]?._id
    };

    const response = await fetch('/api/cds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao criar CD');
      return;
    }

    toast.success('CD criado com sucesso');
    router.push('/admin/cds');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo CD</h1>
        <p className="text-sm text-muted-foreground">Cadastre um CD com suas faixas.</p>
      </div>
      <form className="grid gap-6 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Gravadora</Label>
            <Input id="company" {...form.register('company')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="release_date">Data de lançamento</Label>
            <Input id="release_date" {...form.register('release_date')} />
          </div>
          <div className="flex items-center gap-2">
            <input id="published" type="checkbox" {...form.register('published')} />
            <Label htmlFor="published">Publicado</Label>
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar CD'}
          </Button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Informações</Label>
            <RichTextEditor value={form.watch('info') || ''} onChange={(value) => form.setValue('info', value)} />
          </div>
          <div className="space-y-2">
            <Label>Capa</Label>
            <ImageUpload value={cover} onChange={setCover} folder="cds" />
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
              <div key={index} className="rounded-md border p-4">
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
                    <Label>Gravadora</Label>
                    <Input
                      value={track.publishing_company || ''}
                      onChange={(event) => updateTrack(index, 'publishing_company', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Compositores</Label>
                    <Input
                      value={track.composers || ''}
                      onChange={(event) => updateTrack(index, 'composers', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Input value={track.time || ''} onChange={(event) => updateTrack(index, 'time', event.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Áudio</Label>
                    <AudioUpload
                      value={track.audioFile ?? undefined}
                      onChange={(audio) => {
                        updateTrack(index, 'audioFile', audio ?? null);
                        updateTrack(index, 'track', audio?._id ?? undefined);
                      }}
                      folder="tracks"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Letra</Label>
                    <RichTextEditor value={track.lyric || ''} onChange={(value) => updateTrack(index, 'lyric', value)} rows={4} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Ficha Técnica</Label>
                    <RichTextEditor
                      value={track.data_sheet || ''}
                      onChange={(value) => updateTrack(index, 'data_sheet', value)}
                      rows={4}
                    />
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
