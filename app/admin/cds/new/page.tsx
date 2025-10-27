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
import { GripVertical, PlusCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  composers: z.string().optional(),
  time: z
    .string()
    .regex(/^$|^(\d{1,2}):(\d{2})$/u, 'Informe a duração no formato mm:ss')
    .optional(),
  lyric: z.string().optional()
});

type TrackForm = {
  id: string;
  title: string;
  composers: string;
  time: string;
  lyric: string;
  audioFile: UploadedAudio | null;
};

type FormValues = z.infer<typeof formSchema>;

function createEmptyTrack(): TrackForm {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return {
    id,
    title: '',
    composers: '',
    time: '',
    lyric: '',
    audioFile: null
  };
}

export default function NewCdPage() {
  const router = useRouter();
  const [cover, setCover] = useState<UploadedImage[]>([]);
  const [tracks, setTracks] = useState<TrackForm[]>([]);
  const [trackErrors, setTrackErrors] = useState<Record<string, { title?: string; time?: string }>>({});
  const [coverError, setCoverError] = useState<string | null>(null);
  const [expandedTrackIds, setExpandedTrackIds] = useState<string[]>([]);

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
    const newTrack = createEmptyTrack();
    setTracks((prev) => [...prev, newTrack]);
    setExpandedTrackIds([newTrack.id]);
  };

  const updateTrack = <K extends keyof Omit<TrackForm, 'id'>>(trackId: string, key: K, value: TrackForm[K]) => {
    setTracks((prev) => prev.map((track) => (track.id === trackId ? { ...track, [key]: value } : track)));
    if (key === 'title' || key === 'time') {
      setTrackErrors((prev) => {
        if (!(trackId in prev)) return prev;
        const next = { ...prev };
        const { [key]: _removed, ...rest } = next[trackId];
        if (Object.keys(rest).length === 0) {
          delete next[trackId];
        } else {
          next[trackId] = rest;
        }
        return next;
      });
    }
  };

  const removeTrack = (trackId: string) => {
    const confirmed = window.confirm('Deseja remover esta faixa?');
    if (!confirmed) return;
    setTracks((prev) => {
      const index = prev.findIndex((track) => track.id === trackId);
      const updated = prev.filter((track) => track.id !== trackId);
      setExpandedTrackIds((prevExpanded) => {
        if (!prevExpanded.includes(trackId)) {
          return prevExpanded;
        }
        if (!updated.length) {
          return [];
        }
        const withoutRemoved = prevExpanded.filter((id) => id !== trackId);
        const fallbackIndex = Math.min(Math.max(index, 0), updated.length - 1);
        const fallbackId = updated[fallbackIndex]?.id;
        if (!fallbackId) {
          return withoutRemoved;
        }
        if (withoutRemoved.includes(fallbackId)) {
          return withoutRemoved;
        }
        return [...withoutRemoved, fallbackId];
      });
      return updated;
    });
    setTrackErrors((prev) => {
      if (!(trackId in prev)) return prev;
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
  };

  const toggleTrackExpansion = (trackId: string) => {
    setExpandedTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
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

    const errors: Record<string, { title?: string; time?: string }> = {};
    for (const track of tracks) {
      const result = trackFormSchema.safeParse({
        title: track.title.trim(),
        composers: track.composers.trim() ? track.composers.trim() : undefined,
        time: track.time.trim(),
        lyric: track.lyric.trim()
      });
      if (!result.success) {
        const fieldErrors = result.error.formErrors.fieldErrors;
        const trackError: { title?: string; time?: string } = {};
        if (fieldErrors.title?.[0]) {
          trackError.title = fieldErrors.title[0];
        }
        if (fieldErrors.time?.[0]) {
          trackError.time = fieldErrors.time[0];
        }
        if (!trackError.title && !trackError.time) {
          trackError.title = 'Verifique os campos da faixa informada.';
        }
        errors[track.id] = trackError;
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
      const composers = track.composers.trim();
      const parts = [title];
      if (composers) parts.push(composers);
      const trackName = `${index + 1}-${parts.join('-')}`;

      return {
        name: trackName,
        composers: composers || undefined,
        time: track.time.trim() || undefined,
        lyric: track.lyric.trim() || undefined,
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
              <Input id="title" placeholder="Ex: Nome do álbum" {...form.register('title')} />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Gravadora</Label>
                <Input id="company" placeholder="Ex: Nome da gravadora" {...form.register('company')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="release_date">Ano de lançamento *</Label>
                <Input id="release_date" placeholder="Ex: 1975" maxLength={4} {...form.register('release_date')} />
                {form.formState.errors.release_date ? (
                  <p className="text-sm text-destructive">{form.formState.errors.release_date.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Informe apenas o ano com quatro dígitos.</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="info">Informações / Descrição</Label>
              <RichTextEditor
                value={form.watch('info') || ''}
                onChange={(value) => form.setValue('info', value)}
                placeholder="Adicione informações sobre o álbum, contexto histórico, curiosidades..."
              />
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
            {tracks.map((track, index) => {
              const isExpanded = expandedTrackIds.includes(track.id);
              const hasErrors = Boolean(trackErrors[track.id]);
              const trimmedTitle = track.title.trim();
              const trackLabel = trimmedTitle
                ? `Faixa ${index + 1} - ${trimmedTitle}`
                : `Faixa ${index + 1} (sem nome)`;

              return (
                <div
                  key={track.id}
                  className="rounded-lg border"
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(event, track.id)}
                >
                  <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 items-center gap-3">
                      <button
                        type="button"
                        className="cursor-grab rounded-md border p-2 text-muted-foreground transition hover:text-foreground"
                        draggable
                        onDragStart={(event) => handleDragStart(event, track.id)}
                        aria-label="Reordenar faixa"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'flex flex-1 items-center gap-2 text-left transition-colors',
                          isExpanded ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => toggleTrackExpansion(track.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`track-panel-${track.id}`}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="flex-1 truncate text-base font-medium">{trackLabel}</span>
                        {track.audioFile && (
                          <span className="text-lg" aria-hidden>
                            🎵
                          </span>
                        )}
                        {hasErrors && <span className="text-destructive">•</span>}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTrack(track.id)}
                      aria-label="Remover faixa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div
                    id={`track-panel-${track.id}`}
                    aria-hidden={!isExpanded}
                    className={cn(
                      'transition-all duration-300 ease-in-out',
                      isExpanded ? 'max-h-[2000px] border-t border-border opacity-100' : 'max-h-0 opacity-0'
                    )}
                  >
                    <div
                      className={cn(
                        'grid gap-4 p-4 md:grid-cols-2',
                        isExpanded ? 'pointer-events-auto' : 'pointer-events-none'
                      )}
                    >
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`track-title-${track.id}`}>Nome da música *</Label>
                        <Input
                          id={`track-title-${track.id}`}
                          placeholder="Ex: Nome da faixa"
                          value={track.title}
                          onChange={(event) => updateTrack(track.id, 'title', event.target.value)}
                        />
                        {trackErrors[track.id]?.title && (
                          <p className="text-sm text-destructive">{trackErrors[track.id]?.title}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`track-composers-${track.id}`}>Compositores</Label>
                        <Input
                          id={`track-composers-${track.id}`}
                          placeholder="Ex: Nome dos compositores"
                          value={track.composers}
                          onChange={(event) => updateTrack(track.id, 'composers', event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`track-time-${track.id}`}>Duração</Label>
                        <Input
                          id={`track-time-${track.id}`}
                          placeholder="Ex: 03:45"
                          value={track.time}
                          onChange={(event) => updateTrack(track.id, 'time', event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Informe a duração no formato mm:ss.</p>
                        {trackErrors[track.id]?.time && (
                          <p className="text-sm text-destructive">{trackErrors[track.id]?.time}</p>
                        )}
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`track-lyric-${track.id}`}>Letra / Lyric</Label>
                        <RichTextEditor
                          value={track.lyric}
                          onChange={(value) => updateTrack(track.id, 'lyric', value)}
                          placeholder="Adicione a letra completa da faixa, se disponível."
                          rows={6}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Áudio da faixa</Label>
                        <AudioUpload
                          value={track.audioFile ?? undefined}
                          onChange={(audio) => updateTrack(track.id, 'audioFile', audio ?? null)}
                          folder="tracks"
                        />
                        <p className="text-xs text-muted-foreground">MP3, WAV, FLAC | Máx: 100MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
