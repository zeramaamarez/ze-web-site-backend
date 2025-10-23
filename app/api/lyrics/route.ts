import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import LyricModel from '@/lib/models/Lyric';
import { lyricSchema } from '@/lib/validations/lyric';
import { requireAdmin } from '@/lib/api';

const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'year']);

function buildSort(sortParam?: string | null) {
  const sortField = sortParam?.replace(/^-/, '') || 'createdAt';
  const direction = sortParam?.startsWith('-') || !sortParam ? -1 : 1;
  if (!SORT_FIELDS.has(sortField)) {
    return { createdAt: -1 } as const;
  }
  return { [sortField]: direction } as Record<string, 1 | -1>;
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
  const search = searchParams.get('search');
  const publishedParam = searchParams.get('published');
  const sort = buildSort(searchParams.get('sort'));

  const andFilters: Record<string, unknown>[] = [];
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

  if (publishedParam === 'true') {
    andFilters.push({ published_at: { $ne: null } });
  } else if (publishedParam === 'false') {
    andFilters.push({ published_at: null });
  }

  const filter: Record<string, unknown> = andFilters.length ? { $and: andFilters } : {};

  await connectMongo();
  const total = await LyricModel.countDocuments(filter);
  const lyrics = await LyricModel.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return NextResponse.json({
    data: lyrics,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
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
