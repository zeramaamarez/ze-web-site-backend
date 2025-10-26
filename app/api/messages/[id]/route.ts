import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import MessageModel from '@/lib/models/Message';
import { messageSchema } from '@/lib/validations/message';
import { requireAdmin } from '@/lib/api';
import { isObjectId } from '@/lib/utils';
import { normalizeDocument, withPublishedFlag } from '@/lib/legacy';

function formatMessage(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const normalized = (normalizeDocument(doc) ?? {}) as Record<string, unknown>;
  return withPublishedFlag(normalized);
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await connectMongo();
  const identifier = params.id;
  if (!isObjectId(identifier)) {
    return NextResponse.json(null, { status: 404 });
  }

  const message = await MessageModel.findById(identifier).lean();

  if (!message) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json(formatMessage(message));
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

    const { private: privateValue, published_at, publishedAt, response, status: _status, ...rest } = parsed.data;

    Object.assign(message, rest, { updated_by: authResult.session.user!.id });

    if (response !== undefined) {
      message.response = response ?? undefined;
    }

    const hasPublishedUpdate = Object.prototype.hasOwnProperty.call(parsed.data, 'published_at') ||
      Object.prototype.hasOwnProperty.call(parsed.data, 'publishedAt');

    if (hasPublishedUpdate) {
      const nextPublishedAt = published_at ?? publishedAt ?? null;
      if (nextPublishedAt) {
        message.published_at = nextPublishedAt;
        message.publishedAt = nextPublishedAt;
        message.private = false;
        message.status = 'published';
      } else {
        message.published_at = null;
        message.publishedAt = null;
        message.private = true;
        message.status = 'draft';
      }
    }

    if (privateValue !== undefined) {
      if (privateValue) {
        message.private = true;
        message.published_at = null;
        message.publishedAt = null;
        message.status = 'draft';
      } else {
        message.private = false;
        if (!message.published_at) {
          const nextPublishedAt = new Date();
          message.published_at = nextPublishedAt;
          message.publishedAt = nextPublishedAt;
        }
        message.status = 'published';
      }
    }

    await message.save();

    const updated = await MessageModel.findById(message._id).lean();
    return NextResponse.json(formatMessage(updated));
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

  await message.deleteOne();

  return NextResponse.json({ message: 'Mensagem removida' });
}
