import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import MessageModel from '@/lib/models/Message';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const message = await MessageModel.findById(params.id);
  if (!message) {
    return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 });
  }

  if (message.published_at) {
    message.published_at = null;
    message.publishedAt = null;
    message.private = true;
    message.status = 'draft';
  } else {
    const now = new Date();
    message.published_at = now;
    message.publishedAt = now;
    message.private = false;
    message.status = 'published';
  }
  message.updated_by = authResult.session.user!.id;
  await message.save();

  return NextResponse.json({ published_at: message.published_at, private: message.private, status: message.status });
}
