import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { dvdSchema } from '@/lib/validations/dvd';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';

const LEGACY_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title']);
const SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'release_date', 'published_at']);

function buildLegacySort(sortParam?: string | null) {
  const sortField = sortParam?.replace(/^-/, '') || 'createdAt';
  const direction = sortParam?.startsWith('-') || !sortParam ? -1 : 1;
  if (!LEGACY_SORT_FIELDS.has(sortField)) {
    return { createdAt: -1 } as const;
  }
  return { [sortField]: direction } as Record<string, 1 | -1>;
}

function buildSort(sortParam?: string | null, orderParam?: string | null) {
  if (sortParam && orderParam && SORTABLE_FIELDS.has(sortParam)) {
    const direction = orderParam === 'asc' ? 1 : -1;
    return { [sortParam]: direction } as Record<string, 1 | -1>;
  }

  return buildLegacySort(sortParam);
}

async function serializeDvd(id: string) {
  return DvdModel.findById(id)
    .populate('cover')
    .populate({ path: 'track.ref', model: 'DvdTrack' })
    .lean();
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ('response' in authResult) return authResult.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limitParam = searchParams.get('pageSize') || searchParams.get('limit') || '20';
  const limit = Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100);
  const search = searchParams.get('search');
  const statusParam = searchParams.get('status') || searchParams.get('published');
  const sort = buildSort(searchParams.get('sort'), searchParams.get('order'));
  const yearFilter = searchParams.get('year');

  const andFilters: Record<string, unknown>[] = [];
  if (search) {
    andFilters.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { release_date: { $regex: search, $options: 'i' } }
      ]
    });
  }

  if (statusParam === 'true' || statusParam === 'published') {
    andFilters.push({ published_at: { $ne: null } });
  } else if (statusParam === 'false' || statusParam === 'draft') {
    andFilters.push({ published_at: null });
  }

  if (yearFilter) {
    andFilters.push({ release_date: { $regex: new RegExp(yearFilter, 'i') } });
  }

  const filter: Record<string, unknown> = andFilters.length ? { $and: andFilters } : {};

  await connectMongo();
  const total = await DvdModel.countDocuments(filter);
  const dvds = await DvdModel.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('cover')
    .populate({ path: 'track.ref', model: 'DvdTrack' })
    .lean();

  return NextResponse.json({
    data: dvds,
    pagination: {
      page,
      limit,
      pageSize: limit,
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
    const parsed = dvdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();

    const dvd = await DvdModel.create({
      ...parsed.data,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    if (parsed.data.tracks?.length) {
      const trackRefs = [] as { ref: string; kind: string }[];
      for (const track of parsed.data.tracks) {
        const trackDoc = await DvdTrackModel.create({
          name: track.name,
          composers: track.composers,
          publishing_company: track.publishing_company,
          time: track.time,
          lyric: track.lyric
        });
        trackRefs.push({ ref: trackDoc._id.toString(), kind: 'ComponentDvdTrack' });
      }
      dvd.track = trackRefs.map((track) => ({ ref: track.ref, kind: track.kind }));
      await dvd.save();
    }

    if (parsed.data.cover) {
      await attachFile({ fileId: parsed.data.cover, refId: dvd._id, kind: 'Dvd', field: 'cover' });
    }

    return NextResponse.json(await serializeDvd(dvd._id.toString()), { status: 201 });
  } catch (error) {
    console.error('DVD create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
