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

  try {
    await connectMongo();
    const updated = await MessageModel.findByIdAndUpdate(
      params.id,
      {
        $set: { published: false },
        $unset: { status: 1, published_at: 1, publishedAt: 1 }
      },
      { new: true, lean: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 });
    }

    return NextResponse.json(formatMessage(updated));
  } catch (error) {
    console.error('Message unpublish error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
