import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import LyricModel from '@/lib/models/Lyric';
import { lyricSchema } from '@/lib/validations/lyric';
import { requireAdmin } from '@/lib/api';
import { normalizeDocument, parseLegacyPagination, withPublishedFlag } from '@/lib/legacy';

const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'year']);

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
        { composers: { $regex: search, $options: 'i' } },
        { album: { $regex: search, $options: 'i' } },
        { year: { $regex: search, $options: 'i' } }
      ]
    });
  }

  if (publishedParam === 'false') {
    andFilters.push({ published_at: null });
  }

  const filter: Record<string, unknown> = andFilters.length ? { $and: andFilters } : {};

  await connectMongo();
  const query = LyricModel.find(filter).sort(sort).lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const lyrics = await query;
  const formatted = lyrics.map((lyric) => {
    const normalized = (normalizeDocument(lyric) ?? {}) as Record<string, unknown>;
    return withPublishedFlag({ ...normalized, composer: normalized.composer ?? normalized.composers } as Record<string, unknown>);
  });

  return NextResponse.json(formatted);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  try {
    const body = await request.json();
    const parsed = lyricSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const lyric = await LyricModel.create({
      ...parsed.data,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    return NextResponse.json(await LyricModel.findById(lyric._id).lean(), { status: 201 });
  } catch (error) {
    console.error('Lyric create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
