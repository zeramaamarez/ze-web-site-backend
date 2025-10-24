import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import PhotoModel from '@/lib/models/Photo';
import { photoSchema } from '@/lib/validations/photo';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';
import {
  buildUploadMap,
  collectPhotoUploadIds,
  formatPhoto,
  normalizeFileIdList,
  resolveObjectIdString
} from '@/app/api/photos/utils';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await connectMongo();
  const identifier = params.id;

  const doc = await PhotoModel.findOne(isObjectId(identifier) ? { _id: identifier } : { slug: identifier }).lean();
  if (!doc) {
    return NextResponse.json(null, { status: 404 });
  }

  const uploadMap = await buildUploadMap(collectPhotoUploadIds(doc));
  const photo = formatPhoto(doc, { uploadMap });

  return NextResponse.json(photo);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  if (!isObjectId(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = photoSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const photo = await PhotoModel.findById(params.id);
    if (!photo) {
      return NextResponse.json({ error: 'Galeria não encontrada' }, { status: 404 });
    }

    const { url: rawUrl, images, ...rest } = parsed.data;
    const previousUrls = normalizeFileIdList(photo.url as unknown);

    Object.assign(photo, rest, { updated_by: authResult.session.user!.id });

    const hasUrlUpdate =
      Object.prototype.hasOwnProperty.call(parsed.data, 'url') ||
      Object.prototype.hasOwnProperty.call(parsed.data, 'images');

    if (hasUrlUpdate) {
      const normalizedUrl = normalizeFileIdList(rawUrl ?? images ?? []);
      photo.url = normalizedUrl as unknown as typeof photo.url;

      const previousSet = new Set(previousUrls);
      const currentSet = new Set(normalizedUrl);

      const added = normalizedUrl.filter((id) => !previousSet.has(id));
      const removed = previousUrls.filter((id) => !currentSet.has(id));

      if (added.length > 0) {
        await Promise.all(
          added.map((id) => attachFile({ fileId: id, refId: photo._id, kind: 'Photo', field: 'url' }))
        );
      }

      if (removed.length > 0) {
        await Promise.all(
          removed.map(async (id) => {
            await detachFile(id, photo._id);
            await deleteFileIfOrphan(id);
          })
        );
      }
    }

    await photo.save();

    const updatedDoc = await PhotoModel.findById(photo._id).lean();
    const uploadMap = await buildUploadMap(collectPhotoUploadIds(updatedDoc));
    return NextResponse.json(formatPhoto(updatedDoc, { uploadMap }));
  } catch (error) {
    console.error('Photo update error', error);
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
  const photo = await PhotoModel.findById(params.id);
  if (!photo) {
    return NextResponse.json({ error: 'Galeria não encontrada' }, { status: 404 });
  }

  const urlIds = normalizeFileIdList(photo.url as unknown);
  const legacyImageId = resolveObjectIdString((photo as { image?: unknown }).image);
  if (legacyImageId && !urlIds.includes(legacyImageId)) {
    urlIds.push(legacyImageId);
  }
  await photo.deleteOne();

  if (urlIds.length > 0) {
    await Promise.all(
      urlIds.map(async (id) => {
        await detachFile(id, photo._id);
        await deleteFileIfOrphan(id);
      })
    );
  }

  return NextResponse.json({ message: 'Galeria removida' });
}
