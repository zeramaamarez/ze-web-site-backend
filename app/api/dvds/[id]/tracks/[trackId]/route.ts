import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function DELETE(_: Request, { params }: { params: { id: string; trackId: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id) || !isObjectId(params.trackId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const dvd = await DvdModel.findById(params.id);
  if (!dvd) {
    return NextResponse.json({ error: 'DVD não encontrado' }, { status: 404 });
  }

  dvd.track = (dvd.track || []).filter((item) => item.ref?.toString() !== params.trackId);
  dvd.updated_by = authResult.session.user!.id;
  await dvd.save();

  await DvdTrackModel.findByIdAndDelete(params.trackId);

  return NextResponse.json({ message: 'Faixa removida' });
}
