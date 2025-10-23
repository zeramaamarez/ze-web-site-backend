import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import MessageModel from '@/lib/models/Message';
import { messageSchema } from '@/lib/validations/message';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const message = await MessageModel.findById(params.id).populate('cover').lean();
  if (!message) {
    return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 });
  }

  return NextResponse.json(message);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = messageSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const message = await MessageModel.findById(params.id);
    if (!message) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 });
    }

    const previousCover = message.cover?.toString();

    Object.assign(message, parsed.data, { updated_by: authResult.session.user!.id });
    await message.save();

    if (parsed.data.cover && parsed.data.cover !== previousCover) {
      await attachFile({ fileId: parsed.data.cover, refId: message._id, kind: 'Message', field: 'cover' });
      await detachFile(previousCover, message._id);
      await deleteFileIfOrphan(previousCover);
    } else if (!parsed.data.cover && previousCover) {
      await detachFile(previousCover, message._id);
      await deleteFileIfOrphan(previousCover);
      message.cover = undefined;
      await message.save();
    }

    return NextResponse.json(await MessageModel.findById(message._id).populate('cover').lean());
  } catch (error) {
    console.error('Message update error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
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

  const coverId = message.cover?.toString();
  await message.deleteOne();

  if (coverId) {
    await detachFile(coverId, message._id);
    await deleteFileIfOrphan(coverId);
  }

  return NextResponse.json({ message: 'Mensagem removida' });
}
