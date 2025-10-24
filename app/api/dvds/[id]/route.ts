import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { dvdSchema } from '@/lib/validations/dvd';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';
import LyricModel from '@/lib/models/Lyric';
import UploadFileModel from '@/lib/models/UploadFile';
import { normalizeDocument, normalizeTrackList, normalizeUploadFile, withPublishedFlag } from '@/lib/legacy';

async function serializeDvd(id: string) {
  return DvdModel.findById(id)
    .populate('cover')
    .populate({
      path: 'track',
      model: 'DvdTrack',
      populate: [{ path: 'track', model: 'UploadFile' }]
    })
    .lean();
}

function formatDvd(
  dvd: Record<string, unknown> | null,
  lyricMap?: Map<string, Record<string, unknown>>
) {
  if (!dvd) return null;
  const { track, cover, ...rest } = dvd as typeof dvd & { track?: unknown[]; cover?: unknown };
  const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
  return {
    ...withPublishedFlag(normalizedRest),
    cover: normalizeUploadFile(cover),
    track: normalizeTrackList((track as unknown[]) ?? [], { lyricMap })
  };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectMongo();

    const identifier = params.id;

    // Buscar DVD do banco (SEM .populate()!)
    const dvd = await DvdModel.findOne(
      isObjectId(identifier) ? { _id: identifier } : { slug: identifier }
    ).lean();

    if (!dvd) {
      return NextResponse.json(null, { status: 404 });
    }

    console.log('✅ DVD encontrado:', dvd.title);
    console.log('🎵 Track IDs:', dvd.track);

    // Criar cópia
    const result: any = JSON.parse(JSON.stringify(dvd));

    // Popular COVER manualmente
    if (dvd.cover) {
      try {
        const coverDoc = await UploadFileModel.findById(dvd.cover).lean();
        if (coverDoc) {
          result.cover = JSON.parse(JSON.stringify(coverDoc));
          result.cover.id = coverDoc._id.toString();
        }
      } catch (err) {
        console.error('⚠️ Erro cover:', err);
      }
    }

    // Popular TRACKS manualmente
    if (dvd.track && Array.isArray(dvd.track) && dvd.track.length > 0) {
      try {
        const trackIds = dvd.track.map((t: any) => {
          if (typeof t === 'string') return new Types.ObjectId(t);
          if (typeof t === 'object' && 'ref' in t) return new Types.ObjectId((t as { ref: string }).ref);
          return t;
        });

        console.log('🔍 Buscando DVD tracks:', trackIds.length);

        // Buscar de components_dvd_tracks
        const tracks = await DvdTrackModel.find({
          _id: { $in: trackIds }
        }).lean();

        console.log(`✅ DVD Tracks encontrados: ${tracks.length}`);

        // Popular cada track
        const populatedTracks = [];
        for (const track of tracks) {
          const trackCopy: any = JSON.parse(JSON.stringify(track));
          trackCopy.id = track._id.toString();

          // Popular LYRIC (se existir)
          if (track.lyric) {
            try {
              const lyricDoc = await LyricModel.findById(track.lyric).lean();
              if (lyricDoc) {
                trackCopy.lyric = {
                  _id: lyricDoc._id.toString(),
                  title: (lyricDoc as any).title || '',
                  slug: (lyricDoc as any).slug || '',
                  composer: (lyricDoc as any).composer || '',
                  content: (lyricDoc as any).content || (lyricDoc as any).body || '',
                  id: lyricDoc._id.toString()
                };
              }
            } catch (err) {
              console.error('⚠️ Erro lyric:', err);
            }
          }

          populatedTracks.push(trackCopy);
        }

        result.track = populatedTracks;
        console.log('✅ DVD Tracks populados:', populatedTracks.length);
      } catch (err) {
        console.error('❌ Erro DVD tracks:', err);
      }
    }

    result.id = dvd._id.toString();
    result.published = Boolean(dvd.published_at);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Erro GET DVD:', error);
    return NextResponse.json({ error: 'Erro ao buscar DVD' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = dvdSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const dvd = await DvdModel.findById(params.id);
    if (!dvd) {
      return NextResponse.json({ error: 'DVD não encontrado' }, { status: 404 });
    }

    const previousCover = dvd.cover?.toString();

    Object.assign(dvd, parsed.data, { updated_by: authResult.session.user!.id });

    if (parsed.data.tracks) {
      const keepTrackIds: string[] = [];

      for (const track of parsed.data.tracks) {
        if (track._id && isObjectId(track._id)) {
          const existingTrack = await DvdTrackModel.findById(track._id);
          if (existingTrack) {
            const previousAudio = existingTrack.track?.toString();
            existingTrack.name = track.name;
            existingTrack.composers = track.composers;
            existingTrack.publishing_company = track.publishing_company;
            existingTrack.time = track.time;
            existingTrack.lyric = track.lyric;
            existingTrack.track = track.track || undefined;
            await existingTrack.save();
            if (track.track && track.track !== previousAudio) {
              await attachFile({ fileId: track.track, refId: existingTrack._id, kind: 'DvdTrack', field: 'track' });
              await detachFile(previousAudio, existingTrack._id);
              await deleteFileIfOrphan(previousAudio);
            } else if (!track.track && previousAudio) {
              await detachFile(previousAudio, existingTrack._id);
              await deleteFileIfOrphan(previousAudio);
            }
            keepTrackIds.push(existingTrack._id.toString());
          }
        } else {
          const created = await DvdTrackModel.create({
            name: track.name,
            composers: track.composers,
            publishing_company: track.publishing_company,
            time: track.time,
            lyric: track.lyric,
            track: track.track || undefined
          });
          if (track.track) {
            await attachFile({ fileId: track.track, refId: created._id, kind: 'DvdTrack', field: 'track' });
          }
          keepTrackIds.push(created._id.toString());
        }
      }

      const oldTrackIds = (dvd.track ?? [])
        .map((value) => (typeof value === 'string' ? value : value?.toString()))
        .filter((value): value is string => Boolean(value));

      for (const oldId of oldTrackIds) {
        if (!keepTrackIds.includes(oldId)) {
          const toRemove = await DvdTrackModel.findById(oldId);
          if (toRemove) {
            const audioId = toRemove.track?.toString();
            await toRemove.deleteOne();
            if (audioId) {
              await detachFile(audioId, toRemove._id);
              await deleteFileIfOrphan(audioId);
            }
          }
        }
      }

      dvd.track = keepTrackIds;
    }

    await dvd.save();

    if (parsed.data.cover && parsed.data.cover !== previousCover) {
      await attachFile({ fileId: parsed.data.cover, refId: dvd._id, kind: 'Dvd', field: 'cover' });
      await detachFile(previousCover, dvd._id);
      await deleteFileIfOrphan(previousCover);
    }

    return NextResponse.json(formatDvd(await serializeDvd(dvd._id.toString())));
  } catch (error) {
    console.error('DVD update error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const dvd = await DvdModel.findById(params.id);
  if (!dvd) {
    return NextResponse.json({ error: 'DVD não encontrado' }, { status: 404 });
  }

  const coverId = dvd.cover?.toString();
  const trackIds = (dvd.track ?? [])
    .map((value) => (typeof value === 'string' ? value : value?.toString()))
    .filter((value): value is string => Boolean(value));

  await dvd.deleteOne();
  if (trackIds?.length) {
    const tracks = await DvdTrackModel.find({ _id: { $in: trackIds } });
    for (const track of tracks) {
      const audioId = track.track?.toString();
      await track.deleteOne();
      if (audioId) {
        await detachFile(audioId, track._id);
        await deleteFileIfOrphan(audioId);
      }
    }
  }

  if (coverId) {
    await detachFile(coverId, dvd._id);
    await deleteFileIfOrphan(coverId);
  }

  return NextResponse.json({ message: 'DVD removido' });
}
