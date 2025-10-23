import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const dvd = await DvdModel.findById(params.id);
  if (!dvd) {
    return NextResponse.json({ error: 'DVD não encontrado' }, { status: 404 });
  }

  dvd.published_at = dvd.published_at ? null : new Date();
  dvd.updated_by = authResult.session.user!.id;
  await dvd.save();

  return NextResponse.json({ published_at: dvd.published_at });
}
