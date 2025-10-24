import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import PhotoModel from '@/lib/models/Photo';
import { photoSchema } from '@/lib/validations/photo';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';
import { normalizeDocument, normalizeUploadFileList, parseLegacyPagination, withPublishedFlag } from '@/lib/legacy';

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
  const publishedParam = searchParams.get('published');
  const sort = buildSort(sortField || undefined, sortDirection || null);
  const { start, limit } = parseLegacyPagination(searchParams);

  const andFilters: Record<string, unknown>[] = [];
  andFilters.push({ published_at: { $ne: null } });
  if (search) {
    andFilters.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ]
    });
  }

  if (publishedParam === 'false') {
    andFilters.push({ published_at: null });
  }

  const filter: Record<string, unknown> = andFilters.length ? { $and: andFilters } : {};

  await connectMongo();
  const query = PhotoModel.find(filter).sort(sort).populate('images').lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const photos = await query;
  const formatted = photos.map((photo) => formatPhoto(photo));

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
