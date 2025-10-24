import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongo } from '@/lib/mongodb';
import PhotoModel from '@/lib/models/Photo';
import UploadFileModel from '@/lib/models/UploadFile';
import { photoSchema } from '@/lib/validations/photo';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';
import {
  buildPaginatedResponse,
  buildRegexFilter,
  normalizeDocument,
  normalizeUploadFile,
  normalizeUploadFileList,
  parseLegacyPagination,
  resolveStatusFilter,
  withPublishedFlag
} from '@/lib/legacy';

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
    result.image = undefined;
    return result;
  }

  const resolvedIds = rawUrls
    .map((entry) => resolveObjectId(entry))
    .filter((value): value is Types.ObjectId => Boolean(value));

  const uniqueIds = Array.from(new Map(resolvedIds.map((id) => [id.toString(), id])).values());

  const uploads = uniqueIds.length
    ? await UploadFileModel.find({ _id: { $in: uniqueIds } }).lean()
    : [];

  const uploadMap = new Map<string, Record<string, unknown>>(
    uploads.map((upload) => {
      const copy = JSON.parse(JSON.stringify(upload)) as Record<string, unknown>;
      copy.id = upload._id.toString();
      return [upload._id.toString(), copy];
    })
  );

  const hydratedUrls = rawUrls
    .map((entry) => {
      const id = resolveObjectIdString(entry);
      if (id) {
        const match = uploadMap.get(id);
        if (match) {
          return match;
        }
      }

      if (entry && typeof entry === 'object') {
        const copy = JSON.parse(JSON.stringify(entry)) as Record<string, unknown>;
        if (!copy.id && typeof copy._id === 'string') {
          copy.id = copy._id;
        }
        return copy;
      }

      if (typeof entry === 'string' && Types.ObjectId.isValid(entry)) {
        return { _id: entry, id: entry } as Record<string, unknown>;
      }

      return null;
    })
    .filter((value): value is Record<string, unknown> => Boolean(value));

  result.url = hydratedUrls;
  result.image = hydratedUrls[0] ?? undefined;

  return result;
}

const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'date']);

function buildSort(sortParam?: string | null, directionParam?: string | null) {
  const sortField = sortParam?.replace(/^-/, '') || 'createdAt';
  let direction = sortParam?.startsWith('-') || !sortParam ? -1 : 1;
  if (directionParam) {
    direction = directionParam === 'asc' ? 1 : -1;
  }
  if (!SORT_FIELDS.has(sortField)) {
    return { createdAt: -1 } as const;
  }
  return { [sortField]: direction } as Record<string, 1 | -1>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const [sortField, sortDirection] = (searchParams.get('_sort') || searchParams.get('sort') || '').split(':');
  const search = searchParams.get('search');
  const album = searchParams.get('album');
  const location = searchParams.get('location');
  const sort = buildSort(sortField || undefined, sortDirection || null);
  const { start, limit, shouldPaginate, page } = parseLegacyPagination(searchParams);

  const filters: Record<string, unknown>[] = [];
  const statusFilter = resolveStatusFilter(searchParams, { defaultStatus: shouldPaginate ? 'all' : undefined });
  if (statusFilter) {
    filters.push(statusFilter);
  }

  if (search) {
    const regex = buildRegexFilter(search);
    filters.push({
      $or: [
        { title: regex },
        { description: regex },
        { location: regex },
        { album: regex }
      ]
    });
  }

  if (album) {
    filters.push({ album: buildRegexFilter(album) });
  }

  if (location) {
    filters.push({ location: buildRegexFilter(location) });
  }

  const filter: Record<string, unknown> = filters.length ? { $and: filters } : {};

  await connectMongo();
  const query = PhotoModel.find(filter).sort(sort).lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const [photos, total] = await Promise.all([
    query,
    shouldPaginate ? PhotoModel.countDocuments(filter) : Promise.resolve(undefined)
  ]);

  console.log(`✅ Found ${photos.length} photos`);

  const hydrated = await Promise.all(photos.map((photo) => hydratePhoto(photo)));
  const formatted = hydrated
    .map((photo) => formatPhoto(photo))
    .filter((value): value is Record<string, unknown> => Boolean(value));

  console.log('✅ Photos populados com imagens');

  if (shouldPaginate) {
    return NextResponse.json(buildPaginatedResponse(formatted, { total, limit: limit ?? undefined, start, page }));
  }

  return NextResponse.json(formatted);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  try {
    const body = await request.json();
    const parsed = photoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    const { url: rawUrl, images, ...rest } = parsed.data;
    const normalizedUrl = normalizeFileIdList(rawUrl ?? images ?? []);

    await connectMongo();
    const photo = await PhotoModel.create({
      ...rest,
      url: normalizedUrl,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    if (normalizedUrl.length > 0) {
      await Promise.all(
        normalizedUrl.map((fileId) =>
          attachFile({ fileId, refId: photo._id, kind: 'Photo', field: 'url' })
        )
      );
    }

    const createdDoc = await PhotoModel.findById(photo._id).lean();
    const created = await hydratePhoto(createdDoc);
    return NextResponse.json(formatPhoto(created), { status: 201 });
  } catch (error) {
    console.error('Photo create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
