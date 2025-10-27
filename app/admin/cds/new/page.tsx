'use client';

import type { DragEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUpload, type UploadedImage } from '@/components/admin/image-upload';
import { AudioUpload, type UploadedAudio } from '@/components/admin/audio-upload';
import { toast } from 'sonner';
import { GripVertical, PlusCircle, Trash2 } from 'lucide-react';

const DRAG_DATA_FORMAT = 'application/x-track-id';

const formSchema = z.object({
  title: z
    .string()
    .min(2, 'Informe um título com pelo menos 2 caracteres')
    .max(200, 'Título muito longo'),
  company: z.string().optional(),
  release_date: z
    .string()
    .regex(/^(19|20)\d{2}$/u, 'Informe um ano válido com quatro dígitos (ex: 1975)'),
  info: z.string().optional(),
  published: z.boolean().optional()
});

const trackFormSchema = z.object({
  title: z.string().min(1, 'Informe o nome da música'),
  artist: z.string().optional(),
  composers: z.string().optional()
});

type TrackForm = {
  id: string;
  title: string;
  artist: string;
  composers: string;
  audioFile: UploadedAudio | null;
};

type FormValues = z.infer<typeof formSchema>;

function createEmptyTrack(): TrackForm {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return {
    id,
    title: '',
    artist: '',
    composers: '',
    audioFile: null
  };
}

export default function NewCdPage() {
  const router = useRouter();
  const [cover, setCover] = useState<UploadedImage[]>([]);
  const [tracks, setTracks] = useState<TrackForm[]>([]);
  const [trackErrors, setTrackErrors] = useState<Record<string, string>>({});
  const [coverError, setCoverError] = useState<string | null>(null);

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
    setTracks((prev) => [...prev, createEmptyTrack()]);
  };

  const updateTrack = <K extends keyof Omit<TrackForm, 'id'>>(trackId: string, key: K, value: TrackForm[K]) => {
    setTracks((prev) => prev.map((track) => (track.id === trackId ? { ...track, [key]: value } : track)));
    if (key === 'title') {
      setTrackErrors((prev) => {
        if (!(trackId in prev)) return prev;
        const next = { ...prev };
        delete next[trackId];
        return next;
      });
    }
  };

  const removeTrack = (trackId: string) => {
    const confirmed = window.confirm('Deseja remover esta faixa?');
    if (!confirmed) return;
    setTracks((prev) => prev.filter((track) => track.id !== trackId));
    setTrackErrors((prev) => {
      if (!(trackId in prev)) return prev;
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, trackId: string) => {
    event.dataTransfer.setData(DRAG_DATA_FORMAT, trackId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData(DRAG_DATA_FORMAT);
    if (!sourceId || sourceId === targetId) {
      return;
    }
    setTracks((prev) => {
      const sourceIndex = prev.findIndex((track) => track.id === sourceId);
      const targetIndex = prev.findIndex((track) => track.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) {
        return prev;
      }
      const updated = [...prev];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });
  };

  const validateTracks = () => {
    if (!tracks.length) {
      setTrackErrors({});
      return true;
    }

    const errors: Record<string, string> = {};
    for (const track of tracks) {
      const result = trackFormSchema.safeParse({
        title: track.title.trim(),
        artist: track.artist.trim() ? track.artist.trim() : undefined,
        composers: track.composers.trim() ? track.composers.trim() : undefined
      });
      if (!result.success) {
        const message =
          result.error.formErrors.fieldErrors.title?.[0] ?? 'Informe o nome da música';
        errors[track.id] = message;
      }
    }

    setTrackErrors(errors);
    if (Object.keys(errors).length) {
      toast.error('Preencha os campos obrigatórios das faixas.');
      return false;
    }

    return true;
  };

  const onSubmit = async (values: FormValues) => {
    setCoverError(null);

    if (!cover.length) {
      const message = 'Envie a capa do CD antes de salvar.';
      setCoverError(message);
      toast.error(message);
      return;
    }

    if (!validateTracks()) {
      return;
    }

    const { published, ...rest } = values;
    const trackPayload = tracks.map((track, index) => {
      const title = track.title.trim();
      const artist = track.artist.trim();
      const composers = track.composers.trim();
      const parts = [title];
      if (artist) parts.push(artist);
      if (composers) parts.push(composers);
      const trackName = `${index + 1}-${parts.join('-')}`;

      return {
        name: trackName,
        publishing_company: artist || undefined,
        composers: composers || undefined,
        track: track.audioFile?._id ?? undefined
      };
    });

    const payload = {
      title: rest.title.trim(),
      company: rest.company?.trim() ? rest.company.trim() : undefined,
      release_date: rest.release_date.trim(),
      info: rest.info?.trim() ? rest.info.trim() : undefined,
      cover: cover[0]?._id,
      tracks: trackPayload,
      published_at: published ? new Date().toISOString() : null
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
        <p className="text-sm text-muted-foreground">Cadastre todas as informações antes de publicar.</p>
      </div>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Informações do CD</CardTitle>
            <CardDescription>Preencha os campos principais do álbum.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" placeholder="Ex: Paêbirú" {...form.register('title')} />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Gravadora</Label>
                <Input id="company" placeholder="Ex: Rozenblit" {...form.register('company')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="release_date">Ano de lançamento *</Label>
                <Input id="release_date" placeholder="1975" maxLength={4} {...form.register('release_date')} />
                {form.formState.errors.release_date ? (
                  <p className="text-sm text-destructive">{form.formState.errors.release_date.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Informe apenas o ano com quatro dígitos.</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="info">Informações / Descrição</Label>
              <RichTextEditor value={form.watch('info') || ''} onChange={(value) => form.setValue('info', value)} />
            </div>
            <div className="flex items-center gap-2">
              <input id="published" type="checkbox" {...form.register('published')} />
              <Label htmlFor="published" className="text-sm">Publicado</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capa do CD</CardTitle>
            <CardDescription>Envie a arte final do álbum para exibição.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ImageUpload
              value={cover}
              onChange={(value) => {
                setCover(value);
                setCoverError(null);
              }}
              folder="cds"
            />
            <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG, WEBP</p>
            {coverError && <p className="text-sm text-destructive">{coverError}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Faixas</CardTitle>
              <CardDescription>Adicione, remova ou reordene as faixas do CD.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={addTrack} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Adicionar faixa
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {tracks.length === 0 && (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma faixa adicionada.
              </p>
            )}
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="rounded-lg border p-4"
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, track.id)}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="cursor-grab rounded-md border p-2 text-muted-foreground transition hover:text-foreground"
                      draggable
                      onDragStart={(event) => handleDragStart(event, track.id)}
                      aria-label="Reordenar faixa"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <h3 className="text-base font-medium">Faixa {index + 1}</h3>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeTrack(track.id)} aria-label="Remover faixa">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`track-title-${track.id}`}>Nome da música *</Label>
                    <Input
                      id={`track-title-${track.id}`}
                      placeholder="Ex: Harpa dos Ares"
                      value={track.title}
                      onChange={(event) => updateTrack(track.id, 'title', event.target.value)}
                    />
                    {trackErrors[track.id] && <p className="text-sm text-destructive">{trackErrors[track.id]}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`track-artist-${track.id}`}>Artista</Label>
                    <Input
                      id={`track-artist-${track.id}`}
                      placeholder="Ex: Zé Ramalho"
                      value={track.artist}
                      onChange={(event) => updateTrack(track.id, 'artist', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`track-composers-${track.id}`}>Compositores</Label>
                    <Input
                      id={`track-composers-${track.id}`}
                      placeholder="Ex: Lula Côrtes"
                      value={track.composers}
                      onChange={(event) => updateTrack(track.id, 'composers', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Áudio da faixa</Label>
                    <AudioUpload
                      value={track.audioFile ?? undefined}
                      onChange={(audio) => updateTrack(track.id, 'audioFile', audio ?? null)}
                      folder="tracks"
                    />
                    <p className="text-xs text-muted-foreground">MP3, WAV, FLAC</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardFooter className="flex flex-col gap-3 md:flex-row md:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/cds')}
              disabled={form.formState.isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Salvando...' : 'Salvar CD'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
