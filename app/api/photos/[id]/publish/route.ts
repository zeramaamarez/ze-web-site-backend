import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import PhotoModel from '@/lib/models/Photo';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const photo = await PhotoModel.findById(params.id);
  if (!photo) {
    return NextResponse.json({ error: 'Galeria não encontrada' }, { status: 404 });
  }

  photo.published_at = photo.published_at ? null : new Date();
  photo.updated_by = authResult.session.user!.id;
  await photo.save();

  return NextResponse.json({ published_at: photo.published_at });
}
