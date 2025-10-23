import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import ShowModel from '@/lib/models/Show';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const show = await ShowModel.findById(params.id);
  if (!show) {
    return NextResponse.json({ error: 'Show não encontrado' }, { status: 404 });
  }

  show.published_at = show.published_at ? null : new Date();
  show.updated_by = authResult.session.user!.id;
  await show.save();

  return NextResponse.json({ published_at: show.published_at });
}
