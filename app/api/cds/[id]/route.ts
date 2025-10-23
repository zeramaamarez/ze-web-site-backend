import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import CdTrackModel from '@/lib/models/CdTrack';
import { cdSchema } from '@/lib/validations/cd';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';

async function serializeCd(id: string) {
  return CdModel.findById(id)
    .populate('cover')
    .populate({ path: 'track.ref', model: 'CdTrack' })
    .lean();
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const cd = await serializeCd(params.id);
  if (!cd) {
    return NextResponse.json({ error: 'CD não encontrado' }, { status: 404 });
  }

  return NextResponse.json(cd);
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
            existingTrack.name = track.name;
            existingTrack.composers = track.composers;
            await existingTrack.save();
            newTrackRefs.push({ ref: existingTrack._id.toString(), kind: 'ComponentCdTrack' });
            keepTrackIds.push(existingTrack._id.toString());
          }
        } else {
          const created = await CdTrackModel.create({ name: track.name, composers: track.composers });
          newTrackRefs.push({ ref: created._id.toString(), kind: 'ComponentCdTrack' });
          keepTrackIds.push(created._id.toString());
        }
      }

      const oldTrackIds = cd.track?.map((t) => t.ref?.toString()).filter(Boolean) as string[];
      for (const oldId of oldTrackIds) {
        if (!keepTrackIds.includes(oldId)) {
          await CdTrackModel.findByIdAndDelete(oldId);
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

    return NextResponse.json(await serializeCd(cd._id.toString()));
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
    await CdTrackModel.deleteMany({ _id: { $in: trackIds } });
  }

  if (coverId) {
    await detachFile(coverId, cd._id);
    await deleteFileIfOrphan(coverId);
  }

  return NextResponse.json({ message: 'CD removido' });
}
