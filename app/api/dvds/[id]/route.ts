import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import LyricModel from '@/lib/models/Lyric';
import UploadFileModel from '@/lib/models/UploadFile';
import { dvdSchema } from '@/lib/validations/dvd';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';
import { softDeleteMultipleMedia } from '@/lib/cloudinary-helpers';

function resolveObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  if (typeof value === 'object' && value !== null) {
    const candidate = (value as { _id?: unknown; id?: unknown })._id ?? (value as { id?: unknown }).id;
    return resolveObjectId(candidate);
  }
  return null;
}

async function loadDvd(identifier: string, { log = false } = {}) {
  const logger = (...args: unknown[]) => {
    if (log) {
      console.log(...args);
    }
  };

  const dvdDoc = await DvdModel.findOne(isObjectId(identifier) ? { _id: identifier } : { slug: identifier }).lean();

  if (!dvdDoc) {
    logger('❌ DVD não encontrado');
    return null;
  }

  logger('✅ DVD encontrado:', dvdDoc.title);
  logger('🎵 Track IDs:', dvdDoc.track);

  const result: Record<string, unknown> = JSON.parse(JSON.stringify(dvdDoc));

  if (dvdDoc.cover) {
    try {
      const coverId = resolveObjectId(dvdDoc.cover);
      if (coverId) {
        const coverDoc = await UploadFileModel.findOne({ _id: coverId, deleted: { $ne: true } }).lean();
        if (coverDoc) {
          const coverCopy = JSON.parse(JSON.stringify(coverDoc)) as Record<string, unknown>;
          coverCopy.id = coverDoc._id.toString();
          result.cover = coverCopy;
        }
      }
    } catch (error) {
      logger('⚠️ Erro cover:', error);
    }
  }

  result.track = [];

  if (Array.isArray(dvdDoc.track) && dvdDoc.track.length > 0) {
    try {
      const trackIds = dvdDoc.track
        .map((entry) => {
          if (entry && typeof entry === 'object' && 'ref' in (entry as Record<string, unknown>)) {
            return resolveObjectId((entry as { ref?: unknown }).ref ?? null);
          }
          return resolveObjectId(entry);
        })
        .filter((value): value is Types.ObjectId => Boolean(value));

      logger('🔍 Track IDs a buscar:', trackIds);

      const tracks = await DvdTrackModel.find({ _id: { $in: trackIds } }).lean();
      logger(`✅ Tracks encontrados: ${tracks.length}`);

      const tracksById = new Map<string, Record<string, unknown>>();

      for (const track of tracks) {
        const trackCopy = JSON.parse(JSON.stringify(track)) as Record<string, unknown>;
        const trackIdString = track._id.toString();
        trackCopy.id = trackIdString;

        if (track.lyric) {
          try {
            const lyricId = resolveObjectId(track.lyric);
            if (lyricId) {
              const lyricDoc = await LyricModel.findById(lyricId)
                .select('_id title slug composer content body text')
                .lean();
              if (lyricDoc) {
                trackCopy.lyric = {
                  _id: lyricDoc._id,
                  title: (lyricDoc as Record<string, unknown>).title,
                  slug: (lyricDoc as Record<string, unknown>).slug,
                  composer: (lyricDoc as Record<string, unknown>).composer,
                  content:
                    (lyricDoc as Record<string, unknown>).content ||
                    (lyricDoc as Record<string, unknown>).body ||
                    (lyricDoc as Record<string, unknown>).text ||
                    '',
                  id: lyricDoc._id.toString()
                };
              }
            }
          } catch (error) {
            logger('⚠️ Erro lyric:', error);
          }
        }

        if (track.track) {
          try {
            const audioId = resolveObjectId(track.track);
            if (audioId) {
              const audioDoc = await UploadFileModel.findOne({ _id: audioId, deleted: { $ne: true } }).lean();
              if (audioDoc) {
                const audioCopy = JSON.parse(JSON.stringify(audioDoc)) as Record<string, unknown>;
                audioCopy.id = audioDoc._id.toString();
                trackCopy.track = audioCopy;
              }
            }
          } catch (error) {
            logger('⚠️ Erro audio:', error);
          }
        }

        tracksById.set(trackIdString, trackCopy);
      }

      const orderedTracks = trackIds
        .map((id) => tracksById.get(id.toString()))
        .filter((value): value is Record<string, unknown> => Boolean(value));

      result.track = orderedTracks;
      logger('✅ Tracks populados:', orderedTracks.length);
      if (orderedTracks.length > 0) {
        logger('✅ Primeira track:', JSON.stringify(orderedTracks[0], null, 2));
      }
    } catch (error) {
      logger('❌ Erro tracks:', error);
    }
  }

  result.id = dvdDoc._id.toString();
  result.published = Boolean(dvdDoc.published_at ?? (dvdDoc as { publishedAt?: unknown }).publishedAt);

  return result;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  console.log('\n🔍 ===== GET DVD BY ID =====');
  console.log('📌 ID:', params.id);

  try {
    await connectMongo();

    const dvd = await loadDvd(params.id, { log: true });

    if (!dvd) {
      return NextResponse.json(null, { status: 404 });
    }

    console.log('===== FIM GET DVD =====\n');
    return NextResponse.json(dvd);
  } catch (error) {
    console.error('❌ Erro no GET DVD:', error);
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
    const { tracks, ...restData } = parsed.data;
    const updateData = { ...restData } as typeof restData & { status?: 'draft' | 'published' };
    const hasPublishedAtField =
      Object.prototype.hasOwnProperty.call(body, 'published_at') ||
      Object.prototype.hasOwnProperty.call(body, 'publishedAt');
    if (hasPublishedAtField) {
      const publishedAtValue = updateData.publishedAt ?? updateData.published_at ?? null;
      if (publishedAtValue) {
        updateData.status = 'published';
        updateData.publishedAt = publishedAtValue;
        updateData.published_at = publishedAtValue;
      } else {
        updateData.status = 'draft';
        updateData.publishedAt = null;
        updateData.published_at = null;
      }
    }

    Object.assign(dvd, updateData, { updated_by: authResult.session.user!.id });

    if (tracks) {
      const keepTrackIds: string[] = [];

      for (const track of tracks) {
        if (track._id && isObjectId(track._id)) {
          const existingTrack = await DvdTrackModel.findById(track._id);
          if (existingTrack) {
            const previousAudio = existingTrack.track?.toString();
            existingTrack.name = track.name;
            existingTrack.composers = track.composers;
            existingTrack.label = track.label;
            existingTrack.time = track.time;
            existingTrack.lyric = track.lyric;
            existingTrack.track = track.track || undefined;
            await existingTrack.save();
            if (track.track && track.track !== previousAudio) {
              await attachFile({ fileId: track.track, refId: existingTrack._id, kind: 'DvdTrack', field: 'track' });
              await detachFile(previousAudio, existingTrack._id);
              await deleteFileIfOrphan(previousAudio, {
                reason: 'track_deleted',
                relatedTo: `DvdTrack:${existingTrack._id.toString()}`,
                userId: authResult.session.user!.id
              });
            } else if (!track.track && previousAudio) {
              await detachFile(previousAudio, existingTrack._id);
              await deleteFileIfOrphan(previousAudio, {
                reason: 'track_deleted',
                relatedTo: `DvdTrack:${existingTrack._id.toString()}`,
                userId: authResult.session.user!.id
              });
            }
            keepTrackIds.push(existingTrack._id.toString());
          }
        } else {
          const created = await DvdTrackModel.create({
            name: track.name,
            composers: track.composers,
            label: track.label,
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
              await deleteFileIfOrphan(audioId, {
                reason: 'track_deleted',
                relatedTo: `DvdTrack:${toRemove._id.toString()}`,
                userId: authResult.session.user!.id
              });
            }
          }
        }
      }

      dvd.track = keepTrackIds;
    }

    await dvd.save();

    if (updateData.cover && updateData.cover !== previousCover) {
      await attachFile({ fileId: updateData.cover, refId: dvd._id, kind: 'Dvd', field: 'cover' });
      await detachFile(previousCover, dvd._id);
      await deleteFileIfOrphan(previousCover, {
        reason: 'cover_replaced',
        relatedTo: `Dvd:${dvd._id.toString()}`,
        userId: authResult.session.user!.id
      });
    } else if (!updateData.cover && previousCover) {
      await detachFile(previousCover, dvd._id);
      await deleteFileIfOrphan(previousCover, {
        reason: 'cover_replaced',
        relatedTo: `Dvd:${dvd._id.toString()}`,
        userId: authResult.session.user!.id
      });
    }

    const populatedDvd = await loadDvd(dvd._id.toString());
    return NextResponse.json(populatedDvd);
  } catch (error) {
    console.error('DVD update error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

  const url = new URL(request.url);
  const reason = url.searchParams.get('reason') ?? 'dvd_deleted';

  const coverId = dvd.cover?.toString();
  const trackIds = (dvd.track ?? [])
    .map((value) => (typeof value === 'string' ? value : value?.toString()))
    .filter((value): value is string => Boolean(value));

  const tracks = trackIds.length ? await DvdTrackModel.find({ _id: { $in: trackIds } }) : [];

  const mediaIds: string[] = [];

  if (coverId) {
    mediaIds.push(coverId);
  }

  for (const track of tracks) {
    const audioId = track.track?.toString();
    if (audioId) {
      mediaIds.push(audioId);
      await detachFile(audioId, track._id);
    }
  }

  dvd.deleted = true;
  dvd.deletedAt = new Date();
  dvd.deletionReason = reason;
  dvd.status = 'draft';
  dvd.publishedAt = null;
  dvd.published_at = null;
  dvd.updated_by = authResult.session.user!.id;
  await dvd.save();

  if (coverId) {
    await detachFile(coverId, dvd._id);
  }

  if (mediaIds.length > 0) {
    await softDeleteMultipleMedia(mediaIds, 'dvd_deleted', authResult.session.user!.id, `Dvd:${params.id}`);
  }

  return NextResponse.json({
    message: `DVD marcado como deletado. ${mediaIds.length} arquivos marcados para limpeza.`
  });
}
