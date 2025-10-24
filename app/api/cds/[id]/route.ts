import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import CdTrackModel from '@/lib/models/CdTrack';
import { cdSchema } from '@/lib/validations/cd';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';
import { formatCdForResponse } from '@/app/api/cds/route';

async function serializeCd(id: string) {
  return CdModel.findById(id)
    .populate('cover')
    .populate({ path: 'track.ref', model: 'CdTrack', populate: { path: 'track', model: 'UploadFile' } })
    .lean();
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await connectMongo();
  const identifier = params.id;

  const cd = await CdModel.findOne(isObjectId(identifier) ? { _id: identifier } : { slug: identifier })
    .populate('cover')
    .populate({ path: 'track.ref', model: 'CdTrack', populate: { path: 'track', model: 'UploadFile' } })
    .lean();

  if (!cd) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json(await formatCdForResponse(cd));
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
      const newTrackRefs: { ref: string; kind: string }[] = [];
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
              await attachFile({ fileId: track.track, refId: existingTrack._id, kind: 'ComponentCdTrack', field: 'track' });
              await detachFile(previousAudio, existingTrack._id);
              await deleteFileIfOrphan(previousAudio);
            } else if (!track.track && previousAudio) {
              await detachFile(previousAudio, existingTrack._id);
              await deleteFileIfOrphan(previousAudio);
            }
            newTrackRefs.push({ ref: existingTrack._id.toString(), kind: 'ComponentCdTrack' });
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
            await attachFile({ fileId: track.track, refId: created._id, kind: 'ComponentCdTrack', field: 'track' });
          }
          newTrackRefs.push({ ref: created._id.toString(), kind: 'ComponentCdTrack' });
          keepTrackIds.push(created._id.toString());
        }
      }

      const oldTrackIds = cd.track?.map((t) => t.ref?.toString()).filter(Boolean) as string[];
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

      cd.track = newTrackRefs.map((ref) => ({ ref: ref.ref, kind: ref.kind }));
    }

    await cd.save();

    if (parsed.data.cover && parsed.data.cover !== previousCover) {
      await attachFile({ fileId: parsed.data.cover, refId: cd._id, kind: 'Cd', field: 'cover' });
      await detachFile(previousCover, cd._id);
      await deleteFileIfOrphan(previousCover);
    }

    return NextResponse.json(await formatCdForResponse(await serializeCd(cd._id.toString())));
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
  const trackIds = cd.track?.map((t) => t.ref?.toString()).filter(Boolean) as string[];

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
