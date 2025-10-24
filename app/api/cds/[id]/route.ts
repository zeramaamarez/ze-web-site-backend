import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import CdTrackModel from '@/lib/models/CdTrack';
import LyricModel from '@/lib/models/Lyric';
import UploadFileModel from '@/lib/models/UploadFile';
import { cdSchema } from '@/lib/validations/cd';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';

type TrackReference = string | Types.ObjectId | { ref?: string | Types.ObjectId | null } | null | undefined;

async function fetchCdWithManualPopulate(identifier: string, { log = false } = {}) {
  const logger = (...args: unknown[]) => {
    if (log) {
      console.log(...args);
    }
  };

  const cd = await CdModel.findOne(isObjectId(identifier) ? { _id: identifier } : { slug: identifier }).lean();

  if (!cd) {
    logger('❌ CD não encontrado');
    return null;
  }

  logger('✅ CD encontrado:', cd.title);
  logger('🎵 Track (antes populate):', cd.track);

  if (cd.cover) {
    try {
      const coverValue =
        typeof cd.cover === 'object' && cd.cover !== null && '_id' in cd.cover
          ? (cd.cover as { _id?: Types.ObjectId | string })._id
          : cd.cover;

      if (coverValue && Types.ObjectId.isValid(coverValue)) {
        const coverId = coverValue instanceof Types.ObjectId ? coverValue : new Types.ObjectId(coverValue);
        const coverDoc = await UploadFileModel.findById(coverId).lean();
        if (coverDoc) {
          (cd as any).cover = { ...coverDoc, id: coverDoc._id.toString() };
        }
      }
    } catch (err) {
      logger('⚠️ Erro ao popular cover:', err);
    }
  }

  if (Array.isArray(cd.track) && cd.track.length > 0) {
    try {
      const normalizedTrackIds = cd.track
        .map((entry: TrackReference) => {
          if (!entry) return null;
          if (typeof entry === 'object' && 'ref' in entry && entry.ref) {
            return entry.ref instanceof Types.ObjectId ? entry.ref : new Types.ObjectId(entry.ref);
          }
          if (entry instanceof Types.ObjectId) {
            return entry;
          }
          if (typeof entry === 'string' && Types.ObjectId.isValid(entry)) {
            return new Types.ObjectId(entry);
          }
          return null;
        })
        .filter((value): value is Types.ObjectId => Boolean(value));

      logger('🔍 Track IDs a buscar:', normalizedTrackIds);

      const tracks = await CdTrackModel.find({ _id: { $in: normalizedTrackIds } }).lean();
      logger(`✅ Encontrados ${tracks.length} tracks no banco`);

      const tracksById = new Map<string, any>();

      for (const track of tracks) {
        const trackIdString = track._id.toString();
        (track as any).id = trackIdString;

        if ((track as any).lyric) {
          try {
            const lyricValue = (track as any).lyric;
            const lyricId =
              typeof lyricValue === 'object' && lyricValue !== null && '_id' in lyricValue
                ? (lyricValue as { _id?: Types.ObjectId | string })._id
                : lyricValue;

            if (lyricId && Types.ObjectId.isValid(lyricId)) {
              const lyricDoc = await LyricModel.findById(lyricId)
                .select('_id title slug composer content body text')
                .lean();

              if (lyricDoc) {
                (track as any).lyric = {
                  _id: lyricDoc._id,
                  title: (lyricDoc as any).title,
                  slug: (lyricDoc as any).slug,
                  composer: (lyricDoc as any).composer,
                  content: (lyricDoc as any).content || (lyricDoc as any).body || (lyricDoc as any).text || '',
                  id: lyricDoc._id.toString()
                };
              }
            }
          } catch (err) {
            logger('⚠️ Erro ao popular lyric:', err);
          }
        }

        if ((track as any).track) {
          try {
            const audioValue = (track as any).track;
            const audioId =
              typeof audioValue === 'object' && audioValue !== null && '_id' in audioValue
                ? (audioValue as { _id?: Types.ObjectId | string })._id
                : audioValue;

            if (audioId && Types.ObjectId.isValid(audioId)) {
              const audioDoc = await UploadFileModel.findById(audioId).lean();
              if (audioDoc) {
                (track as any).track = { ...audioDoc, id: audioDoc._id.toString() };
              }
            }
          } catch (err) {
            logger('⚠️ Erro ao popular audio:', err);
          }
        }

        tracksById.set(trackIdString, track);
      }

      const orderedTracks = normalizedTrackIds
        .map((id) => tracksById.get(id.toString()))
        .filter((value): value is Record<string, unknown> => Boolean(value));

      (cd as any).track = orderedTracks;
      logger('✅ Tracks populados:', orderedTracks.length);
      if (orderedTracks.length > 0) {
        logger('✅ Primeira track:', JSON.stringify(orderedTracks[0], null, 2));
      }
    } catch (err) {
      logger('❌ Erro ao popular tracks:', err);
    }
  }

  (cd as any).id = cd._id.toString();
  (cd as any).published = Boolean((cd as any).published_at ?? (cd as any).publishedAt);

  return cd;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  console.log('\n🔍 ===== GET CD BY ID =====');
  console.log('📌 ID:', params.id);

  try {
    await connectMongo();

    const cd = await fetchCdWithManualPopulate(params.id, { log: true });

    if (!cd) {
      return NextResponse.json(null, { status: 404 });
    }

    console.log('===== FIM GET CD =====\n');
    return NextResponse.json(cd);
  } catch (error) {
    console.error('❌ Erro no GET CD:', error);
    return NextResponse.json({ error: 'Erro ao buscar CD' }, { status: 500 });
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
    const parsed = cdSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const cd = await CdModel.findById(params.id);
    if (!cd) {
      return NextResponse.json({ error: 'CD não encontrado' }, { status: 404 });
    }

    const previousCover = cd.cover?.toString();

    Object.assign(cd, parsed.data, { updated_by: authResult.session.user!.id });

    if (parsed.data.tracks) {
      const keepTrackIds: string[] = [];

      for (const track of parsed.data.tracks) {
        if (track._id && isObjectId(track._id)) {
          const existingTrack = await CdTrackModel.findById(track._id);
          if (existingTrack) {
            const previousAudio = existingTrack.track?.toString();
            existingTrack.name = track.name;
            existingTrack.publishing_company = track.publishing_company;
            existingTrack.composers = track.composers;
            existingTrack.time = track.time;
            existingTrack.lyric = track.lyric;
            existingTrack.data_sheet = track.data_sheet;
            existingTrack.track = track.track || undefined;
            await existingTrack.save();
            if (track.track && track.track !== previousAudio) {
              await attachFile({ fileId: track.track, refId: existingTrack._id, kind: 'CdTrack', field: 'track' });
              await detachFile(previousAudio, existingTrack._id);
              await deleteFileIfOrphan(previousAudio);
            } else if (!track.track && previousAudio) {
              await detachFile(previousAudio, existingTrack._id);
              await deleteFileIfOrphan(previousAudio);
            }
            keepTrackIds.push(existingTrack._id.toString());
          }
        } else {
          const created = await CdTrackModel.create({
            name: track.name,
            publishing_company: track.publishing_company,
            composers: track.composers,
            time: track.time,
            track: track.track || undefined,
            lyric: track.lyric,
            data_sheet: track.data_sheet
          });
          if (track.track) {
            await attachFile({ fileId: track.track, refId: created._id, kind: 'CdTrack', field: 'track' });
          }
          keepTrackIds.push(created._id.toString());
        }
      }

      const oldTrackIds = (cd.track ?? [])
        .map((value) => (typeof value === 'string' ? value : value?.toString()))
        .filter((value): value is string => Boolean(value));

      for (const oldId of oldTrackIds) {
        if (!keepTrackIds.includes(oldId)) {
          const toRemove = await CdTrackModel.findById(oldId);
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

      cd.track = keepTrackIds;
    }

    await cd.save();

    if (parsed.data.cover && parsed.data.cover !== previousCover) {
      await attachFile({ fileId: parsed.data.cover, refId: cd._id, kind: 'Cd', field: 'cover' });
      await detachFile(previousCover, cd._id);
      await deleteFileIfOrphan(previousCover);
    }

    const populatedCd = await fetchCdWithManualPopulate(cd._id.toString());
    return NextResponse.json(populatedCd);
  } catch (error) {
    console.error('CD update error', error);
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
  const cd = await CdModel.findById(params.id);
  if (!cd) {
    return NextResponse.json({ error: 'CD não encontrado' }, { status: 404 });
  }

  const coverId = cd.cover?.toString();
  const trackIds = (cd.track ?? [])
    .map((value) => (typeof value === 'string' ? value : value?.toString()))
    .filter((value): value is string => Boolean(value));

  await cd.deleteOne();
  if (trackIds?.length) {
    const tracks = await CdTrackModel.find({ _id: { $in: trackIds } });
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
    await detachFile(coverId, cd._id);
    await deleteFileIfOrphan(coverId);
  }

  return NextResponse.json({ message: 'CD removido' });
}
