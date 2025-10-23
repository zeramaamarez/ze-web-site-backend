import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import CdTrackModel from '@/lib/models/CdTrack';
import { cdSchema } from '@/lib/validations/cd';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';

const LEGACY_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'title']);
const SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'release_date', 'company', 'published_at']);

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

async function serializeCd(id: string) {
  return CdModel.findById(id)
    .populate('cover')
    .populate({ path: 'track.ref', model: 'CdTrack', populate: { path: 'track', model: 'UploadFile' } })
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
  const companyFilter = searchParams.get('company');

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

  if (companyFilter) {
    andFilters.push({ company: { $regex: new RegExp(companyFilter, 'i') } });
  }

  const filter: Record<string, unknown> = andFilters.length ? { $and: andFilters } : {};

  await connectMongo();
  const total = await CdModel.countDocuments(filter);
  const cds = await CdModel.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('cover')
    .populate({ path: 'track.ref', model: 'CdTrack' })
    .lean();

  return NextResponse.json({
    data: cds,
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
    const parsed = cdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();

    const cd = await CdModel.create({
      ...parsed.data,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    if (parsed.data.tracks?.length) {
      const trackRefs = [] as { ref: string; kind: string }[];
      for (const track of parsed.data.tracks) {
        const trackDoc = await CdTrackModel.create({
          name: track.name,
          publishing_company: track.publishing_company,
          composers: track.composers,
          time: track.time,
          track: track.track || undefined,
          lyric: track.lyric,
          data_sheet: track.data_sheet
        });
        if (track.track) {
          await attachFile({ fileId: track.track, refId: trackDoc._id, kind: 'ComponentCdTrack', field: 'track' });
        }
        trackRefs.push({ ref: trackDoc._id.toString(), kind: 'ComponentCdTrack' });
      }
      cd.track = trackRefs.map((track) => ({ ref: track.ref, kind: track.kind }));
      await cd.save();
    }

    if (parsed.data.cover) {
      await attachFile({ fileId: parsed.data.cover, refId: cd._id, kind: 'Cd', field: 'cover' });
    }

    return NextResponse.json(await serializeCd(cd._id.toString()), { status: 201 });
  } catch (error) {
    console.error('CD create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
