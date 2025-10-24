import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongo } from '@/lib/mongodb';
import PhotoModel from '@/lib/models/Photo';
import UploadFileModel from '@/lib/models/UploadFile';
import { photoSchema } from '@/lib/validations/photo';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';
import { normalizeDocument, normalizeUploadFile, withPublishedFlag } from '@/lib/legacy';

function formatPhoto(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const { image, ...rest } = doc as typeof doc & { image?: unknown };
  const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
  return {
    ...withPublishedFlag(normalizedRest),
    image: normalizeUploadFile(image)
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

  const result = JSON.parse(JSON.stringify(doc)) as Record<string, unknown> & { image?: unknown };
  const rawImage = (doc as { image?: unknown }).image;
  const imageId = resolveObjectId(rawImage);

  if (imageId) {
    const image = await UploadFileModel.findById(imageId).lean();
    if (image) {
      const copy = JSON.parse(JSON.stringify(image)) as Record<string, unknown>;
      copy.id = image._id.toString();
      result.image = copy;
    } else {
      result.image = undefined;
    }
  } else {
    result.image = undefined;
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

    const previousImage = photo.image?.toString();

    Object.assign(photo, parsed.data, { updated_by: authResult.session.user!.id });

    if (Object.prototype.hasOwnProperty.call(parsed.data, 'image')) {
      const newImage = parsed.data.image || null;
      photo.image = (newImage || undefined) as any;

      if (newImage && newImage !== previousImage) {
        await attachFile({ fileId: newImage, refId: photo._id, kind: 'Photo', field: 'image' });
        if (previousImage) {
          await detachFile(previousImage, photo._id);
          await deleteFileIfOrphan(previousImage);
        }
      } else if (!newImage && previousImage) {
        await detachFile(previousImage, photo._id);
        await deleteFileIfOrphan(previousImage);
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

  const imageId = photo.image?.toString();
  await photo.deleteOne();

  if (imageId) {
    await detachFile(imageId, photo._id);
    await deleteFileIfOrphan(imageId);
  }

  return NextResponse.json({ message: 'Galeria removida' });
}
