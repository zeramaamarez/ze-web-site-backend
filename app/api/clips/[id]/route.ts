import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import ClipModel from '@/lib/models/Clip';
import { clipSchema } from '@/lib/validations/clip';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';

async function serializeClip(id: string) {
  return ClipModel.findById(id).populate('cover').lean();
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  await connectMongo();
  const clip = await serializeClip(params.id);
  if (!clip) {
    return NextResponse.json({ error: 'Clip não encontrado' }, { status: 404 });
  }

  return NextResponse.json(clip);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = clipSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const clip = await ClipModel.findById(params.id);
    if (!clip) {
      return NextResponse.json({ error: 'Clip não encontrado' }, { status: 404 });
    }

    const previousCovers = (clip.cover || []).map((id) => id.toString());

    Object.assign(clip, parsed.data, { updated_by: authResult.session.user!.id });
    if (parsed.data.cover) {
      clip.cover = parsed.data.cover as unknown as typeof clip.cover;
    }

    await clip.save();

    if (parsed.data.cover) {
      const newCovers = parsed.data.cover;
      const removed = previousCovers.filter((id) => !newCovers.includes(id));
      const added = newCovers.filter((id) => !previousCovers.includes(id));

      for (const fileId of added) {
        await attachFile({ fileId, refId: clip._id, kind: 'Clip', field: 'cover' });
      }

      for (const fileId of removed) {
        await detachFile(fileId, clip._id);
        await deleteFileIfOrphan(fileId);
      }
    }

    return NextResponse.json(await serializeClip(clip._id.toString()));
  } catch (error) {
    console.error('Clip update error', error);
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
  const clip = await ClipModel.findById(params.id);
  if (!clip) {
    return NextResponse.json({ error: 'Clip não encontrado' }, { status: 404 });
  }

  const coverIds = (clip.cover || []).map((id) => id.toString());
  await clip.deleteOne();

  for (const coverId of coverIds) {
    await detachFile(coverId, clip._id);
    await deleteFileIfOrphan(coverId);
  }

  return NextResponse.json({ message: 'Clip removido' });
}
