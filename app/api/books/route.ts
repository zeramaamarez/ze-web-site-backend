import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import BookModel from '@/lib/models/Book';
import { bookSchema } from '@/lib/validations/book';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';
import {
  buildPaginatedResponse,
  buildRegexFilter,
  normalizeDocument,
  normalizeUploadFile,
  parseLegacyPagination,
  resolveStatusFilter,
  withPublishedFlag
} from '@/lib/legacy';

function formatBook(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const { cover, ...rest } = doc as typeof doc & { cover?: unknown };
  const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
  return {
    ...withPublishedFlag(normalizedRest),
    cover: normalizeUploadFile(cover)
  };
}

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
  const sort = buildSort(sortField || undefined, sortDirection || null);
  const search = searchParams.get('search');
  const year = searchParams.get('year');
  const publisher = searchParams.get('publisher');
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
        { author: regex },
        { ISBN: regex }
      ]
    });
  }

  if (year) {
    filters.push({ release_date: buildRegexFilter(year, { startsWith: true }) });
  }

  if (publisher) {
    filters.push({ publishing_company: buildRegexFilter(publisher) });
  }

  const filter: Record<string, unknown> = filters.length ? { $and: filters } : {};

  await connectMongo();

  const query = BookModel.find(filter).sort(sort).populate('cover').lean();
  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }
  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const [books, total] = await Promise.all([
    query,
    shouldPaginate ? BookModel.countDocuments(filter) : Promise.resolve(undefined)
  ]);
  const formatted = books.map((book) => formatBook(book));

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
    const parsed = bookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const book = await BookModel.create({
      ...parsed.data,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    if (parsed.data.cover) {
      await attachFile({ fileId: parsed.data.cover, refId: book._id, kind: 'Book', field: 'cover' });
    }

    const created = await BookModel.findById(book._id).populate('cover').lean();
    return NextResponse.json(formatBook(created), { status: 201 });
  } catch (error) {
    console.error('Book create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
