import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import CdTrackModel from '@/lib/models/CdTrack';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';
import { detachFile } from '@/lib/upload';
import { softDeleteMedia } from '@/lib/cloudinary-helpers';

export async function DELETE(_: Request, { params }: { params: { id: string; trackId: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id) || !isObjectId(params.trackId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();

  const [cd, track] = await Promise.all([
    CdModel.findById(params.id),
    CdTrackModel.findById(params.trackId)
  ]);

  if (!cd) {
    return NextResponse.json({ error: 'CD não encontrado' }, { status: 404 });
  }

  if (!track) {
    return NextResponse.json({ error: 'Faixa não encontrada' }, { status: 404 });
  }

  const audioId = track.track?.toString();

  cd.track = (cd.track || []).filter((item) => {
    if (item && typeof item === 'object' && 'ref' in (item as Record<string, unknown>)) {
      const refValue = (item as { ref?: unknown }).ref;
      return refValue?.toString() !== params.trackId;
    }

    return item?.toString() !== params.trackId;
  });
  cd.updated_by = authResult.session.user!.id;
  await cd.save();

  await track.deleteOne();

  if (audioId) {
    await detachFile(audioId, track._id);
    await softDeleteMedia({
      mediaId: audioId,
      reason: 'track_deleted',
      userId: authResult.session.user!.id,
      relatedTo: `Track:${params.trackId}`
    });
  }

  return NextResponse.json({
    message: 'Faixa removida. Arquivo marcado para limpeza.'
  });
}
