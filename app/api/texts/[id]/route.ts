import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import TextModel from '@/lib/models/Text';
import { textSchema } from '@/lib/validations/text';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';
import { normalizeDocument, withPublishedFlag } from '@/lib/legacy';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await connectMongo();
  const identifier = params.id;

  const text = await TextModel.findOne(isObjectId(identifier) ? { _id: identifier } : { slug: identifier })
    .populate('cover')
    .lean();

  if (!text) {
    return NextResponse.json(null, { status: 404 });
  }

  const { cover, ...rest } = text as typeof text & { cover?: unknown };
  const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
  const formatted = {
    ...withPublishedFlag(normalizedRest),
    cover: normalizeDocument(cover)
  };

  return NextResponse.json(formatted);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = textSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const text = await TextModel.findById(params.id);
    if (!text) {
      return NextResponse.json({ error: 'Texto não encontrado' }, { status: 404 });
    }

    const previousCover = text.cover?.toString();

    Object.assign(text, parsed.data, { updated_by: authResult.session.user!.id });
    await text.save();

    if (parsed.data.cover && parsed.data.cover !== previousCover) {
      await attachFile({ fileId: parsed.data.cover, refId: text._id, kind: 'Text', field: 'cover' });
      await detachFile(previousCover, text._id);
      await deleteFileIfOrphan(previousCover);
    } else if (!parsed.data.cover && previousCover) {
      await detachFile(previousCover, text._id);
      await deleteFileIfOrphan(previousCover);
      text.cover = undefined;
      await text.save();
    }

    return NextResponse.json(await TextModel.findById(text._id).populate('cover').lean());
  } catch (error) {
    console.error('Text update error', error);
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
  const text = await TextModel.findById(params.id);
  if (!text) {
    return NextResponse.json({ error: 'Texto não encontrado' }, { status: 404 });
  }

  const coverId = text.cover?.toString();
  await text.deleteOne();

  if (coverId) {
    await detachFile(coverId, text._id);
    await deleteFileIfOrphan(coverId);
  }

  return NextResponse.json({ message: 'Texto removido' });
}
