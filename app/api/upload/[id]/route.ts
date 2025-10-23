import { NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import { connectMongo } from '@/lib/mongodb';
import UploadFileModel from '@/lib/models/UploadFile';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const file = await UploadFileModel.findById(params.id);
  if (!file) {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
  }

  if (file.related?.length) {
    return NextResponse.json({ error: 'Arquivo em uso', related: file.related }, { status: 400 });
  }

  if (file.provider_metadata?.public_id) {
    try {
      await cloudinary.uploader.destroy(file.provider_metadata.public_id, {
        resource_type: file.provider_metadata.resource_type || 'image'
      });
    } catch (error) {
      console.error('Erro ao remover arquivo do Cloudinary', error);
    }
  }

  await file.deleteOne();
  return NextResponse.json({ message: 'Arquivo removido' });
}
