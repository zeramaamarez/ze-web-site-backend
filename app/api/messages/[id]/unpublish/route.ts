import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import MessageModel from '@/lib/models/Message';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';
import { normalizeDocument, withPublishedFlag } from '@/lib/legacy';

function formatMessage(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const normalized = (normalizeDocument(doc) ?? {}) as Record<string, unknown>;
  const withDefaults = {
    ...normalized,
    response: typeof normalized.response === 'string' ? normalized.response : '',
    published: typeof normalized.published === 'boolean'
      ? normalized.published
      : normalized.status === 'published'
  } as Record<string, unknown>;
  return withPublishedFlag(withDefaults);
}

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

  if (message.published) {
    message.published = false;
    await message.save();
  }

  const updated = await MessageModel.findById(message._id).lean();
  return NextResponse.json(formatMessage(updated));
}
