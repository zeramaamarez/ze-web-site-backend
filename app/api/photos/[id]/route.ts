import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongo } from '@/lib/mongodb';
import PhotoModel from '@/lib/models/Photo';
import UploadFileModel from '@/lib/models/UploadFile';
import { photoSchema } from '@/lib/validations/photo';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';
import { normalizeDocument, normalizeUploadFileList, withPublishedFlag } from '@/lib/legacy';

function formatPhoto(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const { images, ...rest } = doc as typeof doc & { images?: unknown[] };
  const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
  return {
    ...withPublishedFlag(normalizedRest),
    images: normalizeUploadFileList(images)
  };
}

function resolveObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  if (typeof value === 'object' && value !== null) {
    const candidate = (value as { _id?: unknown; id?: unknown })._id ?? (value as { id?: unknown }).id;
    return resolveObjectId(candidate);
  }
  return null;
}

async function hydratePhoto(doc: Record<string, unknown> | null) {
  if (!doc) return null;

  const result = JSON.parse(JSON.stringify(doc)) as Record<string, unknown> & { images?: unknown[] };
  const rawImages = (doc as { images?: unknown }).images;
  const imageIds = Array.isArray(rawImages)
    ? (rawImages as unknown[])
        .map((entry) => {
          if (entry && typeof entry === 'object' && 'ref' in (entry as Record<string, unknown>)) {
            return resolveObjectId((entry as { ref?: unknown }).ref ?? null);
          }
          return resolveObjectId(entry);
        })
        .filter((value): value is Types.ObjectId => Boolean(value))
    : [];

  if (imageIds.length) {
    const images = await UploadFileModel.find({ _id: { $in: imageIds } }).lean();
    const imagesById = new Map(
      images.map((image) => {
        const copy = JSON.parse(JSON.stringify(image)) as Record<string, unknown>;
        copy.id = image._id.toString();
        return [image._id.toString(), copy] as const;
      })
    );

    result.images = imageIds
      .map((id) => imagesById.get(id.toString()))
      .filter((value): value is Record<string, unknown> => Boolean(value));
  } else {
    result.images = [];
  }

  return result;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await connectMongo();
  const identifier = params.id;

  const doc = await PhotoModel.findOne(isObjectId(identifier) ? { _id: identifier } : { slug: identifier }).lean();
  const photo = await hydratePhoto(doc);

  if (!photo) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json(formatPhoto(photo));
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

    const previousImages = photo.images?.map((id) => id.toString()) ?? [];

    Object.assign(photo, parsed.data, { updated_by: authResult.session.user!.id });

    if (Object.prototype.hasOwnProperty.call(parsed.data, 'images')) {
      const newImages = parsed.data.images ?? [];
      photo.images = newImages as any;

      const toAttach = newImages.filter((id) => !previousImages.includes(id));
      const toDetach = previousImages.filter((id) => !newImages.includes(id));

      for (const fileId of toAttach) {
        await attachFile({ fileId, refId: photo._id, kind: 'Photo', field: 'images' });
      }
      for (const fileId of toDetach) {
        await detachFile(fileId, photo._id);
        await deleteFileIfOrphan(fileId);
      }
    }

    await photo.save();

    const updatedDoc = await PhotoModel.findById(photo._id).lean();
    const updated = await hydratePhoto(updatedDoc);
    return NextResponse.json(formatPhoto(updated));
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

  const imageIds = photo.images?.map((id) => id.toString()) ?? [];
  await photo.deleteOne();

  for (const fileId of imageIds) {
    await detachFile(fileId, photo._id);
    await deleteFileIfOrphan(fileId);
  }

  return NextResponse.json({ message: 'Galeria removida' });
}
