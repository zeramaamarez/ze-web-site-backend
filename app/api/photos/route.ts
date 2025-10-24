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
  normalizeUploadFileList,
  parseLegacyPagination,
  resolveStatusFilter,
  withPublishedFlag
} from '@/lib/legacy';

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
  const hydrated = await Promise.all(photos.map((photo) => hydratePhoto(photo)));
  const formatted = hydrated
    .map((photo) => formatPhoto(photo))
    .filter((value): value is Record<string, unknown> => Boolean(value));

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

    await connectMongo();
    const photo = await PhotoModel.create({
      ...parsed.data,
      images: parsed.data.images || [],
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    if (parsed.data.images?.length) {
      for (const fileId of parsed.data.images) {
        await attachFile({ fileId, refId: photo._id, kind: 'Photo', field: 'images' });
      }
    }

    const createdDoc = await PhotoModel.findById(photo._id).lean();
    const created = await hydratePhoto(createdDoc);
    return NextResponse.json(formatPhoto(created), { status: 201 });
  } catch (error) {
    console.error('Photo create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
