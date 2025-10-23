import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import ShowModel from '@/lib/models/Show';
import { showSchema } from '@/lib/validations/show';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';

const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'date']);

function buildSort(sortParam?: string | null) {
  if (!sortParam) {
    return { date: 1 } as const;
  }
  const sortField = sortParam.replace(/^-/, '');
  const direction = sortParam.startsWith('-') ? -1 : 1;
  if (!SORT_FIELDS.has(sortField)) {
    return { date: 1 } as const;
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
  const city = searchParams.get('city');
  const state = searchParams.get('state');
  const status = searchParams.get('status');
  const sort = buildSort(searchParams.get('sort'));

  const andFilters: Record<string, unknown>[] = [];
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

  if (publishedParam === 'true') {
    andFilters.push({ published_at: { $ne: null } });
  } else if (publishedParam === 'false') {
    andFilters.push({ published_at: null });
  }

  const filter: Record<string, unknown> = andFilters.length ? { $and: andFilters } : {};

  await connectMongo();
  const total = await ShowModel.countDocuments(filter);
  const shows = await ShowModel.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('cover')
    .lean();

  const now = Date.now();
  const data = shows.map((show) => ({
    ...show,
    isPast: show.date ? new Date(show.date).getTime() < now : false
  }));

  return NextResponse.json({
    data,
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
