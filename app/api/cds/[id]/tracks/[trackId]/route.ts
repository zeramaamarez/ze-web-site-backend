import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import CdTrackModel from '@/lib/models/CdTrack';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function DELETE(_: Request, { params }: { params: { id: string; trackId: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id) || !isObjectId(params.trackId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const cd = await CdModel.findById(params.id);
  if (!cd) {
    return NextResponse.json({ error: 'CD não encontrado' }, { status: 404 });
  }

  cd.track = (cd.track || []).filter((item) => item.ref?.toString() !== params.trackId);
  cd.updated_by = authResult.session.user!.id;
  await cd.save();

  await CdTrackModel.findByIdAndDelete(params.trackId);

  return NextResponse.json({ message: 'Faixa removida' });
}
