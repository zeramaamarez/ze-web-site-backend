import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import ShowModel from '@/lib/models/Show';
import { showSchema } from '@/lib/validations/show';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';
import { normalizeDocument, parseLegacyPagination, withPublishedFlag } from '@/lib/legacy';

const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'date']);

function buildSort(sortParam?: string | null, directionParam?: string | null) {
  const defaultSort = { date: 1 } as const;
  if (!sortParam) {
    return defaultSort;
  }
  const sortField = sortParam.replace(/^-/, '');
  let direction = sortParam.startsWith('-') ? -1 : 1;
  if (directionParam) {
    direction = directionParam === 'asc' ? 1 : -1;
  }
  if (!SORT_FIELDS.has(sortField)) {
    return defaultSort;
  }
  return { [sortField]: direction } as Record<string, 1 | -1>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const [sortField, sortDirection] = (searchParams.get('_sort') || searchParams.get('sort') || '').split(':');
  const search = searchParams.get('search');
  const publishedParam = searchParams.get('published');
  const city = searchParams.get('city');
  const state = searchParams.get('state');
  const status = searchParams.get('status');
  const sort = buildSort(sortField || undefined, sortDirection || null);
  const { start, limit } = parseLegacyPagination(searchParams);

  const andFilters: Record<string, unknown>[] = [];
  andFilters.push({ published_at: { $ne: null } });
  if (search) {
    andFilters.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { venue: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } }
      ]
    });
  }

  if (city) {
    andFilters.push({ city: { $regex: city, $options: 'i' } });
  }

  if (state) {
    andFilters.push({ state: { $regex: state, $options: 'i' } });
  }

  if (status === 'past') {
    andFilters.push({ date: { $lt: new Date() } });
  } else if (status === 'upcoming') {
    andFilters.push({ date: { $gte: new Date() } });
  }

  if (publishedParam === 'false') {
    andFilters.push({ published_at: null });
  }

  const filter: Record<string, unknown> = andFilters.length ? { $and: andFilters } : {};

  await connectMongo();
  const query = ShowModel.find(filter).sort(sort).populate('cover').lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const shows = await query;
  const now = Date.now();
  const formatted = shows.map((show) => {
    const { cover, ...rest } = show as typeof show & { cover?: unknown };
    const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
    const base = withPublishedFlag(normalizedRest);
    return {
      ...base,
      cover: normalizeDocument(cover),
      isPast: show.date ? new Date(show.date).getTime() < now : false
    };
  });

  return NextResponse.json(formatted);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  try {
    const body = await request.json();
    const parsed = showSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const show = await ShowModel.create({
      ...parsed.data,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    if (parsed.data.cover) {
      await attachFile({ fileId: parsed.data.cover, refId: show._id, kind: 'Show', field: 'cover' });
    }

    return NextResponse.json(await ShowModel.findById(show._id).populate('cover').lean(), { status: 201 });
  } catch (error) {
    console.error('Show create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
