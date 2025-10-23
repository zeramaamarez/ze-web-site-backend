import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { dvdTrackSchema } from '@/lib/validations/dvd';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

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

  const track = await DvdTrackModel.create(parsed.data);
  dvd.track = [...(dvd.track || []), { ref: track._id, kind: 'ComponentDvdTrack' }];
  dvd.updated_by = authResult.session.user!.id;
  await dvd.save();

  return NextResponse.json({
    track: {
      _id: track._id.toString(),
      name: track.name,
      composers: track.composers,
      time: track.time,
      lyric: track.lyric
    }
  }, { status: 201 });
}
