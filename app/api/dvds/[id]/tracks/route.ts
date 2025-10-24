import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { dvdTrackSchema } from '@/lib/validations/dvd';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';
import { attachFile } from '@/lib/upload';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = dvdTrackSchema.omit({ _id: true }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  await connectMongo();
  const dvd = await DvdModel.findById(params.id);
  if (!dvd) {
    return NextResponse.json({ error: 'DVD não encontrado' }, { status: 404 });
  }

  const track = await DvdTrackModel.create({
    name: parsed.data.name,
    composers: parsed.data.composers,
    publishing_company: parsed.data.publishing_company,
    time: parsed.data.time,
    lyric: parsed.data.lyric,
    track: parsed.data.track || undefined
  });
  if (parsed.data.track) {
    await attachFile({ fileId: parsed.data.track, refId: track._id, kind: 'DvdTrack', field: 'track' });
  }
  dvd.track = [...(dvd.track || []), track._id];
  dvd.updated_by = authResult.session.user!.id;
  await dvd.save();

  return NextResponse.json({
    track: {
      _id: track._id.toString(),
      name: track.name,
      composers: track.composers,
      publishing_company: track.publishing_company,
      time: track.time,
      lyric: track.lyric,
      track: track.track?.toString()
    }
  }, { status: 201 });
}
