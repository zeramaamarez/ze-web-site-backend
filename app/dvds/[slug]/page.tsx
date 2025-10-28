import Image from 'next/image';
import { notFound } from 'next/navigation';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { normalizeUploadFile } from '@/lib/legacy';
import type { Metadata } from 'next';

interface DvdDetailParams {
  params: { slug: string };
}

async function getDvd(slug: string) {
  await connectMongo();
  const dvdDoc = await DvdModel.findOne({
    slug,
    status: 'published',
    $or: [{ deleted: { $exists: false } }, { deleted: false }]
  })
    .populate('cover')
    .lean();

  if (!dvdDoc) {
    return null;
  }

  const trackIds = Array.isArray(dvdDoc.track)
    ? dvdDoc.track
        .map((value) => {
          if (typeof value === 'string') return value;
          if (value && typeof value === 'object') {
            const entry = value as { _id?: unknown; id?: unknown; ref?: unknown };
            if (entry.ref && typeof entry.ref === 'object') {
              const ref = entry.ref as { _id?: unknown; id?: unknown };
              if (typeof ref._id === 'string') return ref._id;
              if (typeof ref.id === 'string') return ref.id;
            }
            if (typeof entry._id === 'string') return entry._id;
            if (typeof entry.id === 'string') return entry.id;
          }
          return null;
        })
        .filter((value): value is string => Boolean(value))
    : [];

  const tracks = trackIds.length
    ? await DvdTrackModel.find({ _id: { $in: trackIds } })
        .populate('track')
        .lean()
    : [];

  const tracksById = new Map<string, typeof tracks[number]>();
  for (const track of tracks) {
    tracksById.set(track._id.toString(), track);
  }

  const orderedTracks = trackIds
    .map((id) => tracksById.get(id))
    .filter((track): track is typeof tracks[number] => Boolean(track))
    .map((track) => ({
      id: track._id.toString(),
      name: track.name,
      composers: track.composers ?? '',
      label: (track as { label?: string }).label ?? '',
      time: track.time ?? '',
      lyric: typeof track.lyric === 'string' ? track.lyric : '',
      audio: normalizeUploadFile(track.track)
    }));

  return {
    id: dvdDoc._id.toString(),
    title: dvdDoc.title,
    company: dvdDoc.company ?? '',
    release_date: dvdDoc.release_date ?? '',
    info: typeof dvdDoc.info === 'string' ? dvdDoc.info : '',
    videoUrl: typeof dvdDoc.videoUrl === 'string' ? dvdDoc.videoUrl : '',
    cover: normalizeUploadFile(dvdDoc.cover),
    tracks: orderedTracks
  };
}

export async function generateMetadata({ params }: DvdDetailParams): Promise<Metadata> {
  const dvd = await getDvd(params.slug);
  if (!dvd) {
    return { title: 'DVD não encontrado' };
  }
  return { title: `${dvd.title} · DVDs` };
}

export default async function DvdDetailPage({ params }: DvdDetailParams) {
  const dvd = await getDvd(params.slug);
  if (!dvd) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl border bg-muted">
          {dvd.cover?.url ? (
            <Image src={dvd.cover.url} alt={dvd.cover.name || dvd.title} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem capa</div>
          )}
        </div>
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{dvd.title}</h1>
            {dvd.company && <p className="text-muted-foreground">{dvd.company}</p>}
            {dvd.release_date && <p className="text-sm text-muted-foreground">Lançamento: {dvd.release_date}</p>}
          </div>
          {dvd.info && (
            <div className="prose max-w-none text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: dvd.info }} />
          )}
        </div>
      </header>

      {dvd.videoUrl && (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Assista</h2>
          <div className="relative w-full overflow-hidden rounded-xl border bg-black pb-[56.25%]">
            <iframe
              src={dvd.videoUrl}
              title={dvd.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Faixas</h2>
        {dvd.tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma faixa cadastrada.</p>
        ) : (
          <ol className="space-y-4">
            {dvd.tracks.map((track, index) => (
              <li key={track.id} className="rounded-xl border p-4 shadow-sm">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold">
                    {String(index + 1).padStart(2, '0')} · {track.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {track.composers ? `Compositores: ${track.composers}` : 'Compositores não informados'}
                  </p>
                  {track.label && <p className="text-sm text-muted-foreground">Gravadora: {track.label}</p>}
                  {track.time && <p className="text-xs text-muted-foreground">Duração: {track.time}</p>}
                </div>
                {track.audio?.url && (
                  <audio controls className="mt-3 w-full">
                    <source src={track.audio.url} />
                    Seu navegador não suporta o elemento de áudio.
                  </audio>
                )}
                {track.lyric && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium">Ver letra</summary>
                    <div
                      className="prose prose-sm mt-2 max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: track.lyric }}
                    />
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
