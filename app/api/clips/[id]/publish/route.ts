import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import ClipModel from '@/lib/models/Clip';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const clip = await ClipModel.findById(params.id);
  if (!clip) {
    return NextResponse.json({ error: 'Clip não encontrado' }, { status: 404 });
  }

  clip.published_at = clip.published_at ? null : new Date();
  clip.updated_by = authResult.session.user!.id;
  await clip.save();

  return NextResponse.json({ published_at: clip.published_at });
}
