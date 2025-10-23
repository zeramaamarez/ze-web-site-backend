import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import TextModel from '@/lib/models/Text';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const text = await TextModel.findById(params.id);
  if (!text) {
    return NextResponse.json({ error: 'Texto não encontrado' }, { status: 404 });
  }

  text.published_at = text.published_at ? null : new Date();
  text.updated_by = authResult.session.user!.id;
  await text.save();

  return NextResponse.json({ published_at: text.published_at });
}
