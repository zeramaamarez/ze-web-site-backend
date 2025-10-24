import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import PhotoModel from '@/lib/models/Photo';
import { photoSchema } from '@/lib/validations/photo';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';
import { buildPaginatedResponse, buildRegexFilter, parseLegacyPagination, resolveStatusFilter } from '@/lib/legacy';
import { buildUploadMap, collectPhotoUploadIds, formatPhoto, normalizeFileIdList } from '@/app/api/photos/utils';

const SORT_FIELD_ALIASES = new Map([
  ['created_at', 'createdAt'],
  ['updated_at', 'updatedAt'],
  ['published_at', 'published_at'],
  ['publishedAt', 'published_at'],
  ['release_date', 'release_date'],
  ['releaseDate', 'release_date'],
  ['createdAt', 'createdAt'],
  ['updatedAt', 'updatedAt'],
  ['title', 'title'],
  ['date', 'date']
]);

const SORT_FIELDS = new Set(Array.from(SORT_FIELD_ALIASES.values()));

function normalizeSortField(field: string | undefined | null) {
  if (!field) return 'createdAt';
  const trimmed = field.trim();
  if (!trimmed) return 'createdAt';
  const alias = SORT_FIELD_ALIASES.get(trimmed);
  return alias ?? trimmed;
}

function buildSort(sortParam?: string | null, directionParam?: string | null) {
  let direction: 1 | -1 = 1;
  let rawField = sortParam || undefined;

  if (rawField && rawField.startsWith('-')) {
    direction = -1;
    rawField = rawField.slice(1);
  }

  const sortField = normalizeSortField(rawField);

  if (directionParam) {
    const normalizedDirection = directionParam.toLowerCase();
    direction = normalizedDirection === 'asc' ? 1 : -1;
  }

  if (!SORT_FIELDS.has(sortField)) {
    return { createdAt: 1, _id: 1 } as const;
  }

  const sort: Record<string, 1 | -1> = { [sortField]: direction };
  if (sortField !== '_id') {
    sort._id = direction;
  }
  return sort;
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

  const uploadIds = new Set<string>();
  for (const photo of photos) {
    const ids = collectPhotoUploadIds(photo as { url?: unknown; image?: unknown });
    for (const id of ids) {
      uploadIds.add(id);
    }
  }

  const uploadMap = await buildUploadMap(uploadIds);

  const formatted = photos
    .map((photo) => formatPhoto(photo as Record<string, unknown>, { uploadMap }))
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
    const uploadMap = await buildUploadMap(collectPhotoUploadIds(createdDoc));
    return NextResponse.json(formatPhoto(createdDoc, { uploadMap }), { status: 201 });
  } catch (error) {
    console.error('Photo create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
