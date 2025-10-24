import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import PhotoModel from '@/lib/models/Photo';
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
  const query = PhotoModel.find(filter).sort(sort).populate('images').lean();

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
  const formatted = photos.map((photo) => formatPhoto(photo));

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

    const created = await PhotoModel.findById(photo._id).populate('images').lean();
    return NextResponse.json(formatPhoto(created), { status: 201 });
  } catch (error) {
    console.error('Photo create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
