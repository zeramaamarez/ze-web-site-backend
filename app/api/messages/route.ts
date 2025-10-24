import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import MessageModel from '@/lib/models/Message';
import { messageSchema } from '@/lib/validations/message';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';
import { normalizeDocument, parseLegacyPagination, withPublishedFlag } from '@/lib/legacy';

const SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title']);

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
        { excerpt: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ]
    });
  }

  if (publishedParam === 'false') {
    andFilters.push({ published_at: null });
  }

  const filter: Record<string, unknown> = andFilters.length ? { $and: andFilters } : {};

  await connectMongo();
  const query = MessageModel.find(filter).sort(sort).populate('cover').lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const messages = await query;
  const formatted = messages.map((message) => {
    const { cover, ...rest } = message as typeof message & { cover?: unknown };
    const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
    return {
      ...withPublishedFlag(normalizedRest),
      cover: normalizeDocument(cover)
    };
  });

  return NextResponse.json(formatted);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  try {
    const body = await request.json();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const message = await MessageModel.create({
      ...parsed.data,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    if (parsed.data.cover) {
      await attachFile({ fileId: parsed.data.cover, refId: message._id, kind: 'Message', field: 'cover' });
    }

    return NextResponse.json(await MessageModel.findById(message._id).populate('cover').lean(), { status: 201 });
  } catch (error) {
    console.error('Message create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
