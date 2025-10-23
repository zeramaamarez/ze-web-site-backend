import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import CdTrackModel from '@/lib/models/CdTrack';
import { cdTrackSchema } from '@/lib/validations/cd';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

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

  const track = await CdTrackModel.create(parsed.data);
  cd.track = [...(cd.track || []), { ref: track._id, kind: 'ComponentCdTrack' }];
  cd.updated_by = authResult.session.user!.id;
  await cd.save();

  return NextResponse.json({
    track: {
      _id: track._id.toString(),
      name: track.name,
      composers: track.composers
    }
  }, { status: 201 });
}
