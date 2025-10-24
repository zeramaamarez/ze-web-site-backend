import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import ClipModel from '@/lib/models/Clip';
import { clipSchema } from '@/lib/validations/clip';
import { requireAdmin } from '@/lib/api';
import { attachFile, detachFile, deleteFileIfOrphan } from '@/lib/upload';
import {
  normalizeDocument,
  normalizeUploadFile,
  normalizeUploadFileList,
  parseLegacyPagination,
  withPublishedFlag
} from '@/lib/legacy';

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

async function serializeClip(id: string) {
  return ClipModel.findById(id).populate('cover').lean();
}

function formatClip(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  const { cover, ...rest } = doc as typeof doc & { cover?: unknown };
  const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
  const coverValue = Array.isArray(cover) ? normalizeUploadFileList(cover) : normalizeUploadFile(cover);
  return {
    ...withPublishedFlag(normalizedRest),
    cover: coverValue
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const [sortField, sortDirection] = (searchParams.get('_sort') || searchParams.get('sort') || '').split(':');
  const sort = buildSort(sortField || undefined, sortDirection || null);
  const search = searchParams.get('search');
  const { start, limit } = parseLegacyPagination(searchParams);

  const filters: Record<string, unknown>[] = [{ published_at: { $ne: null } }];
  if (search) {
    filters.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { info: { $regex: search, $options: 'i' } }
      ]
    });
  }

  const filter: Record<string, unknown> = { $and: filters };

  await connectMongo();
  const query = ClipModel.find(filter).sort(sort).populate('cover').lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const clips = await query;
  const formatted = clips.map((clip) => formatClip(clip));

  return NextResponse.json(formatted);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  try {
    const body = await request.json();
    const parsed = clipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();
    const clip = await ClipModel.create({
      ...parsed.data,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id,
      cover: parsed.data.cover || []
    });

    if (parsed.data.cover?.length) {
      for (const fileId of parsed.data.cover) {
        await attachFile({ fileId, refId: clip._id, kind: 'Clip', field: 'cover' });
      }
    }

    return NextResponse.json(formatClip(await serializeClip(clip._id.toString())), { status: 201 });
  } catch (error) {
    console.error('Clip create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
