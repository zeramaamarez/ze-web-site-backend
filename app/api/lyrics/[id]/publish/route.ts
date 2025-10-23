import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import LyricModel from '@/lib/models/Lyric';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const lyric = await LyricModel.findById(params.id);
  if (!lyric) {
    return NextResponse.json({ error: 'Letra não encontrada' }, { status: 404 });
  }

  lyric.published_at = lyric.published_at ? null : new Date();
  lyric.updated_by = authResult.session.user!.id;
  await lyric.save();

  return NextResponse.json({ published_at: lyric.published_at });
}
