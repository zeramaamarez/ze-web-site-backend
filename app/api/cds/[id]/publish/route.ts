import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const cd = await CdModel.findById(params.id);
  if (!cd) {
    return NextResponse.json({ error: 'CD não encontrado' }, { status: 404 });
  }

  cd.published_at = cd.published_at ? null : new Date();
  cd.updated_by = authResult.session.user!.id;
  await cd.save();

  return NextResponse.json({ published_at: cd.published_at });
}
