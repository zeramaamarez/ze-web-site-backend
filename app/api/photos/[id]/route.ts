import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongo } from '@/lib/mongodb';
import PhotoModel from '@/lib/models/Photo';
import UploadFileModel from '@/lib/models/UploadFile';
import { photoSchema } from '@/lib/validations/photo';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import { isObjectId } from '@/lib/utils';
import { normalizeDocument, normalizeUploadFile, normalizeUploadFileList, withPublishedFlag } from '@/lib/legacy';

function formatPhoto(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const { url, image, ...rest } = doc as typeof doc & { url?: unknown; image?: unknown };
  const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
  const normalizedUrl = normalizeUploadFileList(url);
  const normalizedImage = normalizedUrl.length > 0 ? normalizedUrl[0] : normalizeUploadFile(image);
  return {
    ...withPublishedFlag(normalizedRest),
    url: normalizedUrl,
    image: normalizedImage
  };
}

function resolveObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as { _id?: unknown; id?: unknown; ref?: unknown };
    if (record._id) return resolveObjectId(record._id);
    if (record.id) return resolveObjectId(record.id);
    if (record.ref) return resolveObjectId(record.ref);
  }
  return null;
}

function resolveObjectIdString(value: unknown) {
  const objectId = resolveObjectId(value);
  if (objectId) {
    return objectId.toString();
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as { _id?: unknown; id?: unknown };
    if (typeof record._id === 'string') return record._id;
    if (typeof record.id === 'string') return record.id;
  }
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return value;
  }
  return null;
}

function normalizeFileIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => resolveObjectIdString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

async function hydratePhoto(doc: Record<string, unknown> | null) {
  if (!doc) return null;

  const result = JSON.parse(JSON.stringify(doc)) as Record<string, unknown> & { url?: unknown; image?: unknown };
  const rawUrls = Array.isArray((doc as { url?: unknown }).url)
    ? ((doc as { url?: unknown }).url as unknown[])
    : [];

  if (rawUrls.length === 0) {
    result.url = [];
    result.image = null;
    return result;
  }

  const resolvedIds = rawUrls
    .map((entry) => resolveObjectIdString(entry))
    .filter((value): value is string => Boolean(value && Types.ObjectId.isValid(value)));

  const uniqueIds = Array.from(new Set(resolvedIds));

  const uploads = uniqueIds.length
    ? await UploadFileModel.find({ _id: { $in: uniqueIds } }).lean()
    : [];

  const uploadMap = new Map<string, Record<string, unknown>>();

  for (const upload of uploads) {
    const normalized = normalizeUploadFile(upload);
    if (!normalized || typeof normalized !== 'object') {
      continue;
    }
    const record = normalized as Record<string, unknown>;
    const uploadRecord = upload as Record<string, unknown>;
    const id =
      typeof record.id === 'string'
        ? record.id
        : typeof record._id === 'string'
        ? record._id
        : resolveObjectIdString(uploadRecord._id) ?? resolveObjectIdString(uploadRecord.id);
    if (!id) {
      continue;
    }
    record.id = id;
    record._id = id;
    uploadMap.set(id, record);
  }

  const hydratedUrls = rawUrls
    .map((entry) => {
      const id = resolveObjectIdString(entry);
      if (id) {
        const match = uploadMap.get(id);
        if (match) {
          return match;
        }
      }

      const fallback = normalizeUploadFile(entry);
      if (fallback && typeof fallback === 'object') {
        const record = fallback as Record<string, unknown>;
        const fallbackId =
          typeof record.id === 'string'
            ? record.id
            : typeof record._id === 'string'
            ? record._id
            : id ?? null;
        if (fallbackId) {
          record.id = fallbackId;
          record._id = fallbackId;
        }
        return record;
      }

      if (id) {
        return { _id: id, id } as Record<string, unknown>;
      }

      return null;
    })
    .filter((value): value is Record<string, unknown> => Boolean(value));

  result.url = hydratedUrls;
  result.image = hydratedUrls[0] ?? null;

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

    const { url: rawUrl, images, ...rest } = parsed.data;
    const previousUrls = Array.isArray(photo.url)
      ? photo.url
          .map((entry: unknown) => resolveObjectIdString(entry))
          .filter((entry): entry is string => Boolean(entry))
      : [];

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
