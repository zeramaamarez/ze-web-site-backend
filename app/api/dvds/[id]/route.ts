import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { dvdSchema } from '@/lib/validations/dvd';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';

async function serializeDvd(id: string) {
  return DvdModel.findById(id)
    .populate('cover')
    .populate({ path: 'track.ref', model: 'DvdTrack' })
    .lean();
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const dvd = await serializeDvd(params.id);
  if (!dvd) {
    return NextResponse.json({ error: 'DVD não encontrado' }, { status: 404 });
  }

  return NextResponse.json(dvd);
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
      const newTrackRefs: { ref: string; kind: string }[] = [];
      const keepTrackIds: string[] = [];

      for (const track of parsed.data.tracks) {
        if (track._id && isObjectId(track._id)) {
          const existingTrack = await DvdTrackModel.findById(track._id);
          if (existingTrack) {
            existingTrack.name = track.name;
            existingTrack.composers = track.composers;
            existingTrack.publishing_company = track.publishing_company;
            existingTrack.time = track.time;
            existingTrack.lyric = track.lyric;
            await existingTrack.save();
            newTrackRefs.push({ ref: existingTrack._id.toString(), kind: 'ComponentDvdTrack' });
            keepTrackIds.push(existingTrack._id.toString());
          }
        } else {
          const created = await DvdTrackModel.create({
            name: track.name,
            composers: track.composers,
            publishing_company: track.publishing_company,
            time: track.time,
            lyric: track.lyric
          });
          newTrackRefs.push({ ref: created._id.toString(), kind: 'ComponentDvdTrack' });
          keepTrackIds.push(created._id.toString());
        }
      }

      const oldTrackIds = dvd.track?.map((t) => t.ref?.toString()).filter(Boolean) as string[];
      for (const oldId of oldTrackIds) {
        if (!keepTrackIds.includes(oldId)) {
          await DvdTrackModel.findByIdAndDelete(oldId);
        }
      }

      dvd.track = newTrackRefs.map((ref) => ({ ref: ref.ref, kind: ref.kind }));
    }

    await dvd.save();

    if (parsed.data.cover && parsed.data.cover !== previousCover) {
      await attachFile({ fileId: parsed.data.cover, refId: dvd._id, kind: 'Dvd', field: 'cover' });
      await detachFile(previousCover, dvd._id);
      await deleteFileIfOrphan(previousCover);
    }

    return NextResponse.json(await serializeDvd(dvd._id.toString()));
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
  const trackIds = dvd.track?.map((t) => t.ref?.toString()).filter(Boolean) as string[];

  await dvd.deleteOne();
  if (trackIds?.length) {
    await DvdTrackModel.deleteMany({ _id: { $in: trackIds } });
  }

  if (coverId) {
    await detachFile(coverId, dvd._id);
    await deleteFileIfOrphan(coverId);
  }

  return NextResponse.json({ message: 'DVD removido' });
}
