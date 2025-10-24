import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import CdTrackModel from '@/lib/models/CdTrack';
import { cdTrackSchema } from '@/lib/validations/cd';
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
  const parsed = cdTrackSchema.omit({ _id: true }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  await connectMongo();
  const cd = await CdModel.findById(params.id);
  if (!cd) {
    return NextResponse.json({ error: 'CD não encontrado' }, { status: 404 });
  }

  const track = await CdTrackModel.create({
    name: parsed.data.name,
    publishing_company: parsed.data.publishing_company,
    composers: parsed.data.composers,
    time: parsed.data.time,
    track: parsed.data.track || undefined,
    lyric: parsed.data.lyric,
    data_sheet: parsed.data.data_sheet
  });
  if (parsed.data.track) {
    await attachFile({ fileId: parsed.data.track, refId: track._id, kind: 'CdTrack', field: 'track' });
  }
  cd.track = [...(cd.track || []), track._id];
  cd.updated_by = authResult.session.user!.id;
  await cd.save();

  return NextResponse.json({
    track: {
      _id: track._id.toString(),
      name: track.name,
      publishing_company: track.publishing_company,
      composers: track.composers,
      time: track.time,
      track: track.track?.toString(),
      lyric: track.lyric,
      data_sheet: track.data_sheet
    }
  }, { status: 201 });
}
