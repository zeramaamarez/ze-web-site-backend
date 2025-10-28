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

const videoUrlSchema = z
  .string()
  .url('Informe uma URL válida')
  .refine(
    (value) =>
      /^(https?:\/\/)?(www\.|player\.)?vimeo\.com\/(\d+|video\/\d+|channels\/.+\/\d+|groups\/.+\/videos\/\d+)/i.test(value) ||
      /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/embed\/|youtu\.be\/)[\w-]+/i.test(value),
    'Informe uma URL do Vimeo ou YouTube'
  );

const formSchema = z.object({
  title: z
    .string()
    .min(2, 'Informe um título com pelo menos 2 caracteres')
    .max(200, 'Título muito longo'),
  company: z.string().optional(),
  release_date: z
    .string()
    .regex(/^(19|20)\d{2}$/u, 'Informe um ano válido com quatro dígitos (ex: 2019)'),
  info: z.string().optional(),
  videoUrl: videoUrlSchema,
  published: z.boolean().optional()
});

const trackFormSchema = z.object({
  title: z.string().min(1, 'Informe o nome da faixa'),
  composers: z.string().optional(),
  label: z.string().optional(),
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
  label: string;
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
    label: '',
    time: '',
    lyric: '',
    audioFile: null
  };
}

export default function NewDvdPage() {
  const router = useRouter();
  const [cover, setCover] = useState<UploadedImage[]>([]);
  const [tracks, setTracks] = useState<TrackForm[]>([]);
  const [trackErrors, setTrackErrors] = useState<Record<string, { title?: string; time?: string }>>({});
  const [coverError, setCoverError] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

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

  const addTrack = () => {
    const newTrack = createEmptyTrack();
    setTracks((prev) => [...prev, newTrack]);
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
    setTracks((prev) => prev.filter((track) => track.id !== trackId));
    setOpenAccordions((prev) => {
      if (!prev.has(trackId)) return prev;
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
    setTrackErrors((prev) => {
      if (!(trackId in prev)) return prev;
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
  };

  const toggleTrackExpansion = (trackId: string) => {
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
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

    const errors: Record<string, { title?: string; time?: string }> = {};
    for (const track of tracks) {
      const result = trackFormSchema.safeParse({
        title: track.title.trim(),
        composers: track.composers.trim() ? track.composers.trim() : undefined,
        label: track.label.trim() ? track.label.trim() : undefined,
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
      const message = 'Envie a capa do DVD antes de salvar.';
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
        label: track.label.trim() || undefined,
        time: track.time.trim() || undefined,
        lyric: track.lyric.trim() || undefined,
        track: track.audioFile?._id ?? undefined
      };
    });

    const publishedAt = published ? new Date().toISOString() : null;

    const payload = {
      title: rest.title.trim(),
      company: rest.company?.trim() ? rest.company.trim() : undefined,
      release_date: rest.release_date.trim(),
      info: rest.info?.trim() ? rest.info.trim() : undefined,
      videoUrl: rest.videoUrl.trim(),
      cover: cover[0]?._id,
      tracks: trackPayload,
      published_at: publishedAt,
      publishedAt,
      status: published ? 'published' : 'draft'
    };

    const response = await fetch('/api/dvds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || 'Erro ao criar DVD');
      return;
    }

    const data = (await response.json().catch(() => null)) as { _id?: string; id?: string } | null;
    toast.success('DVD criado com sucesso');
    const dvdId = data?._id ?? data?.id;
    router.push(dvdId ? `/admin/dvds/${dvdId}` : '/admin/dvds');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo DVD</h1>
        <p className="text-sm text-muted-foreground">Cadastre todas as informações antes de publicar.</p>
      </div>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Informações do DVD</CardTitle>
            <CardDescription>Preencha os campos principais do material.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" placeholder="Ex: Nome do DVD" {...form.register('title')} />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Produtora</Label>
                <Input id="company" placeholder="Ex: © 2019 Avôhai - Discobertas" {...form.register('company')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="release_date">Ano de lançamento *</Label>
                <Input id="release_date" placeholder="Ex: 2019" maxLength={4} {...form.register('release_date')} />
                {form.formState.errors.release_date ? (
                  <p className="text-sm text-destructive">{form.formState.errors.release_date.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Informe apenas o ano com quatro dígitos.</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="videoUrl">URL do vídeo *</Label>
              <Input id="videoUrl" placeholder="https://player.vimeo.com/" {...form.register('videoUrl')} />
              {form.formState.errors.videoUrl && (
                <p className="text-sm text-destructive">{form.formState.errors.videoUrl.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="info">Informações / Descrição</Label>
              <RichTextEditor
                value={form.watch('info') || ''}
                onChange={(value) => form.setValue('info', value)}
                placeholder="Adicione informações sobre o DVD, bastidores, curiosidades..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input id="published" type="checkbox" {...form.register('published')} />
              <Label htmlFor="published" className="text-sm">
                Publicado
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capa do DVD</CardTitle>
            <CardDescription>Envie a arte que será exibida nas listagens.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ImageUpload
              value={cover}
              onChange={(value) => {
                setCover(value);
                setCoverError(null);
              }}
              folder="dvds"
            />
            <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG, WEBP</p>
            {coverError && <p className="text-sm text-destructive">{coverError}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Faixas</CardTitle>
              <CardDescription>Adicione, remova ou reordene as faixas do DVD.</CardDescription>
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
              const isExpanded = openAccordions.has(track.id);
              const hasErrors = Boolean(trackErrors[track.id]);
              const trimmedTitle = track.title.trim();
              const trackLabel = trimmedTitle ? `Faixa ${index + 1} - ${trimmedTitle}` : `Faixa ${index + 1} (sem nome)`;

              return (
                <div
                  key={track.id}
                  className="rounded-lg border"
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(event, track.id)}
                >
                  <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="hidden cursor-grab rounded-md border bg-muted/40 p-2 text-muted-foreground transition hover:bg-muted md:block"
                        onDragStart={(event) => handleDragStart(event, track.id)}
                        draggable
                        aria-label="Reordenar faixa"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <div>
                        <button
                          type="button"
                          className={cn('flex items-center gap-2 font-medium', hasErrors && 'text-destructive')}
                          onClick={() => toggleTrackExpansion(track.id)}
                          aria-expanded={isExpanded}
                        >
                          {trackLabel}
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {track.composers.trim() || 'Compositores não informados'} · {track.time.trim() || 'Duração indefinida'}
                        </p>
                        {track.label.trim() && (
                          <p className="text-xs text-muted-foreground">Gravadora: {track.label.trim()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="icon" onClick={() => toggleTrackExpansion(track.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button type="button" variant="destructive" size="icon" onClick={() => removeTrack(track.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="space-y-4 border-t bg-muted/20 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Título *</Label>
                          <Input
                            value={track.title}
                            onChange={(event) => updateTrack(track.id, 'title', event.target.value)}
                          />
                          {trackErrors[track.id]?.title && (
                            <p className="text-sm text-destructive">{trackErrors[track.id]?.title}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Compositores</Label>
                          <Input
                            value={track.composers}
                            onChange={(event) => updateTrack(track.id, 'composers', event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Gravadora</Label>
                          <Input
                            value={track.label}
                            onChange={(event) => updateTrack(track.id, 'label', event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duração</Label>
                          <Input
                            value={track.time}
                            onChange={(event) => updateTrack(track.id, 'time', event.target.value)}
                            placeholder="mm:ss"
                          />
                          {trackErrors[track.id]?.time && (
                            <p className="text-sm text-destructive">{trackErrors[track.id]?.time}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Letra</Label>
                        <RichTextEditor
                          value={track.lyric}
                          onChange={(value) => updateTrack(track.id, 'lyric', value)}
                          placeholder="Cole a letra da música, se disponível"
                          rows={4}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Áudio</Label>
                        <AudioUpload
                          value={track.audioFile ? [track.audioFile] : []}
                          onChange={(files) => updateTrack(track.id, 'audioFile', files[0] ?? null)}
                          folder="dvds/tracks"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Salvando...' : 'Salvar DVD'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
