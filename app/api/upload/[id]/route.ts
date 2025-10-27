import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import UploadFileModel from '@/lib/models/UploadFile';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';
import { softDeleteMedia } from '@/lib/cloudinary-helpers';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const file = await UploadFileModel.findOne({ _id: params.id, deleted: { $ne: true } });
  if (!file) {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
  }

  if (file.related?.length) {
    return NextResponse.json({ error: 'Arquivo em uso', related: file.related }, { status: 400 });
  }

  await softDeleteMedia({
    mediaId: file._id,
    reason: 'manual',
    userId: authResult.session.user!.id,
    relatedTo: `UploadFile:${file._id.toString()}`
  });

  return NextResponse.json({ message: 'Arquivo marcado para revisão' });
}
