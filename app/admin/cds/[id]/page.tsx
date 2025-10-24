'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  tracks: z.array(cdTrackSchema).optional()
});

type TrackForm = z.infer<typeof cdTrackSchema> & { audioFile?: UploadedAudio | null };
type FormValues = z.infer<typeof formSchema>;

export default function EditCdPage() {
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
      published: false
    }
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/cds/${params.id}`);
      if (!response.ok) {
        toast.error('CD não encontrado');
        router.push('/admin/cds');
        return;
      }

      const data = await response.json();
      console.log('📀 Dados do CD recebidos:', data);
      console.log('🎵 Tracks recebidos:', data.track);
      form.reset({
        title: data.title || '',
        company: data.company || '',
        release_date: data.release_date || '',
        info: data.info || '',
        published: Boolean(data.published_at)
      });
      if (data.cover) {
        setCover([{ _id: data.cover._id, url: data.cover.url, name: data.cover.name }]);
      }
      if (Array.isArray(data.track)) {
        console.log('🎵 Número de tracks:', data.track.length);
        const toTrackForm = (track: any): TrackForm => {
          console.log('🔧 toTrackForm recebeu:', track);

          const dataEntry = track?.ref || track;

          console.log('🔧 toTrackForm data extraído:', dataEntry);

          let lyricText = '';
          if (typeof dataEntry?.lyric === 'string') {
            lyricText = dataEntry.lyric;
          } else if (typeof dataEntry?.lyric?.content === 'string') {
            lyricText = dataEntry.lyric.content;
          } else if (typeof dataEntry?.lyric?.body === 'string') {
            lyricText = dataEntry.lyric.body;
          } else if (typeof dataEntry?.lyric?.text === 'string') {
            lyricText = dataEntry.lyric.text;
          }

          let audioFile: TrackForm['audioFile'] = null;
          if (dataEntry?.track && typeof dataEntry.track === 'object') {
            const audio = dataEntry.track as Record<string, any>;
            const audioId = audio._id || audio.id || '';
            const audioUrl = audio.url || '';
            const audioName = audio.name || (audioUrl ? audioUrl.split('/').pop() || '' : '');
            audioFile = {
              _id: audioId,
              url: audioUrl,
              name: audioName
            };
          }

          const result: TrackForm = {
            _id: dataEntry?._id || dataEntry?.id,
            name: dataEntry?.name || '',
            publishing_company: dataEntry?.publishing_company || '',
            composers: dataEntry?.composers || '',
            time: dataEntry?.time || '',
            track: typeof dataEntry?.track === 'string' ? dataEntry.track : dataEntry?.track?._id,
            lyric: lyricText,
            data_sheet: dataEntry?.data_sheet || '',
            audioFile
          };

          console.log('✅ toTrackForm resultado:', result);

          return result;
        };

        const mappedTracks = data.track.map((entry: unknown) => toTrackForm(entry));
        console.log('✅ Tracks mapeados:', mappedTracks);
        setTracks(mappedTracks);
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

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

    const response = await fetch(`/api/cds/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao atualizar CD');
      return;
    }

    toast.success('CD atualizado');
    router.push('/admin/cds');
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar CD</h1>
        <p className="text-sm text-muted-foreground">Atualize os dados do CD.</p>
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
                    <Label>Gravadora</Label>
                    <Input
                      value={track.publishing_company || ''}
                      onChange={(event) => updateTrack(index, 'publishing_company', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Compositores</Label>
                    <Input value={track.composers || ''} onChange={(event) => updateTrack(index, 'composers', event.target.value)} />
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
