import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import MessageModel from '@/lib/models/Message';
import { messageSchema } from '@/lib/validations/message';
import { requireAdmin } from '@/lib/api';
import { buildPaginatedResponse, buildRegexFilter, normalizeDocument, parseLegacyPagination, withPublishedFlag } from '@/lib/legacy';

function formatMessage(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const normalized = (normalizeDocument(doc) ?? {}) as Record<string, unknown>;
  if (!normalized) return null;
  const withDefaults = {
    ...normalized,
    response: typeof normalized.response === 'string' ? normalized.response : '',
    publicada: Boolean(normalized.publicada)
  } as Record<string, unknown>;
  return withPublishedFlag(withDefaults);
}

const SORT_FIELDS = new Map([
  ['createdAt', 'createdAt'],
  ['created_at', 'createdAt'],
  ['updatedAt', 'updatedAt'],
  ['updated_at', 'updatedAt'],
  ['name', 'name'],
  ['title', 'name'],
  ['content', 'message']
]);

function buildSort(sortParam?: string | null, directionParam?: string | null) {
  const resolvedParam = sortParam?.replace(/^-/, '') || 'createdAt';
  const sortField = SORT_FIELDS.get(resolvedParam) ?? 'createdAt';
  let direction = sortParam?.startsWith('-') || !sortParam ? -1 : 1;
  if (directionParam) {
    direction = directionParam === 'asc' ? 1 : -1;
  }
  return { [sortField]: direction } as Record<string, 1 | -1>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const [sortFieldParam, sortDirectionFromSortParam] = (searchParams.get('_sort') || searchParams.get('sort') || '').split(':');
  const explicitOrder = searchParams.get('_order') || searchParams.get('order');
  const sort = buildSort(sortFieldParam || undefined, sortDirectionFromSortParam || explicitOrder || null);
  const search = searchParams.get('search');
  const city = searchParams.get('city');
  const { start, limit, shouldPaginate, page } = parseLegacyPagination(searchParams);

  const filters: Record<string, unknown>[] = [];

  const statusParam = searchParams.get('status');
  if (statusParam === 'published') {
    filters.push({ publicada: true });
  } else if (statusParam === 'draft') {
    filters.push({ publicada: false });
  }

  const publicadaParam = searchParams.get('publicada');
  if (publicadaParam != null) {
    filters.push({ publicada: publicadaParam === 'true' || publicadaParam === '1' });
  }

  if (search) {
    const regex = buildRegexFilter(search);
    filters.push({
      $or: [
        { name: regex },
        { email: regex },
        { city: regex },
        { state: regex },
        { message: regex },
        { response: regex }
      ]
    });
  }

  if (city) {
    filters.push({ city: { $regex: city, $options: 'i' } });
  }

  if (!filters.some((entry) => Object.prototype.hasOwnProperty.call(entry, 'publicada')) && !shouldPaginate) {
    filters.push({ publicada: true });
  }

  const filter: Record<string, unknown> = filters.length ? { $and: filters } : {};

  await connectMongo();
  const query = MessageModel.find(filter).sort(sort).lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const [messages, total] = await Promise.all([
    query,
    shouldPaginate ? MessageModel.countDocuments(filter) : Promise.resolve(undefined)
  ]);
  const formatted = messages.map((message) => formatMessage(message));

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
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const payload = {
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim(),
      city: parsed.data.city.trim(),
      state: parsed.data.state.trim(),
      message: parsed.data.message.trim(),
      response: parsed.data.response?.trim() ?? '',
      publicada: parsed.data.publicada ?? false,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    } as const;

    const message = await MessageModel.create(payload);

    const created = await MessageModel.findById(message._id).lean();
    return NextResponse.json(formatMessage(created), { status: 201 });
  } catch (error) {
    console.error('Message create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
