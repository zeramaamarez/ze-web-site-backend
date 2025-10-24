import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import ShowModel from '@/lib/models/Show';
import { showSchema } from '@/lib/validations/show';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';
import { normalizeDocument, normalizeUploadFile, withPublishedFlag } from '@/lib/legacy';

function formatShow(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const { cover, ...rest } = doc as typeof doc & { cover?: unknown };
  const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
  return {
    ...withPublishedFlag(normalizedRest),
    cover: normalizeUploadFile(cover)
  };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await connectMongo();
  const identifier = params.id;

  const show = await ShowModel.findOne(isObjectId(identifier) ? { _id: identifier } : { slug: identifier })
    .populate('cover')
    .lean();

  if (!show) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json(formatShow(show));
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = showSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const show = await ShowModel.findById(params.id);
    if (!show) {
      return NextResponse.json({ error: 'Show não encontrado' }, { status: 404 });
    }

    const previousCover = show.cover?.toString();

    Object.assign(show, parsed.data, { updated_by: authResult.session.user!.id });
    await show.save();

    if (parsed.data.cover && parsed.data.cover !== previousCover) {
      await attachFile({ fileId: parsed.data.cover, refId: show._id, kind: 'Show', field: 'cover' });
      await detachFile(previousCover, show._id);
      await deleteFileIfOrphan(previousCover);
    } else if (!parsed.data.cover && previousCover) {
      await detachFile(previousCover, show._id);
      await deleteFileIfOrphan(previousCover);
      show.cover = undefined;
      await show.save();
    }

    const updated = await ShowModel.findById(show._id).populate('cover').lean();
    return NextResponse.json(formatShow(updated));
  } catch (error) {
    console.error('Show update error', error);
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
  const show = await ShowModel.findById(params.id);
  if (!show) {
    return NextResponse.json({ error: 'Show não encontrado' }, { status: 404 });
  }

  const coverId = show.cover?.toString();
  await show.deleteOne();

  if (coverId) {
    await detachFile(coverId, show._id);
    await deleteFileIfOrphan(coverId);
  }

  return NextResponse.json({ message: 'Show removido' });
}
