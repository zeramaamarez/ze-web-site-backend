import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import CdModel from '@/lib/models/Cd';
import CdTrackModel from '@/lib/models/CdTrack';
import { cdSchema } from '@/lib/validations/cd';
import { attachFile } from '@/lib/upload';
import { requireAdmin } from '@/lib/api';
import LyricModel from '@/lib/models/Lyric';
import {
  buildPaginatedResponse,
  buildRegexFilter,
  isObjectIdLike,
  normalizeDocument,
  normalizeTrackList,
  normalizeUploadFile,
  parseLegacyPagination,
  resolveStatusFilter,
  withPublishedFlag
} from '@/lib/legacy';

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
    .populate({
      path: 'track.ref',
      model: 'CdTrack',
      populate: [
        { path: 'track', model: 'UploadFile' },
        { path: 'lyric', model: 'Lyric' }
      ]
    })
    .lean();
}

function collectLyricIdsFromCd(cd: { track?: unknown[] }) {
  const ids = new Set<string>();
  for (const entry of cd.track ?? []) {
    const track = (entry as { ref?: { lyric?: unknown } }).ref ?? entry;
    const rawLyric = track?.lyric as unknown;
    if (!rawLyric) continue;
    if (typeof rawLyric === 'string') {
      ids.add(rawLyric);
    } else if (isObjectIdLike(rawLyric)) {
      ids.add(rawLyric.toString());
    } else if (typeof rawLyric === 'object' && rawLyric !== null) {
      const candidate = (rawLyric as { _id?: unknown; id?: unknown })._id ?? (rawLyric as { id?: unknown }).id;
      if (typeof candidate === 'string') {
        ids.add(candidate);
      } else if (isObjectIdLike(candidate)) {
        ids.add(candidate.toString());
      }
    }
  }
  return ids;
}

async function buildLyricMap(ids: Set<string>) {
  if (!ids.size) {
    return new Map<string, Record<string, unknown>>();
  }

  const lyricDocs = await LyricModel.find({ _id: { $in: Array.from(ids) } }).lean();
  return new Map(
    lyricDocs
      .map((doc) => {
        const normalized = normalizeDocument(doc);
        const id = normalized?.id as string | undefined;
        if (!normalized || !id) return null;
        return [id, normalized] as const;
      })
      .filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry))
  );
}

export async function formatCdForResponse(
  cd: Record<string, unknown> | null,
  lyricMap?: Map<string, Record<string, unknown>>
) {
  if (!cd) return null;

  let map = lyricMap;
  if (!map) {
    const ids = collectLyricIdsFromCd(cd as { track?: unknown[] });
    map = await buildLyricMap(ids);
  }

  const { track, cover, ...rest } = cd as typeof cd & { track?: unknown[]; cover?: unknown };
  const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;

  return {
    ...withPublishedFlag(normalizedRest),
    cover: normalizeUploadFile(cover),
    track: normalizeTrackList((track as unknown[]) ?? [], { lyricMap: map })
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sortParam = searchParams.get('_sort') || searchParams.get('sort');
  const [sortField, sortDirection] = sortParam?.split(':') ?? [];
  const sort = buildSort(sortField || undefined, sortDirection || searchParams.get('order'));
  const search = searchParams.get('search');
  const company = searchParams.get('company');
  const year = searchParams.get('year');
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
        { company: regex },
        { info: regex }
      ]
    });
  }

  if (company) {
    filters.push({ company: buildRegexFilter(company) });
  }

  if (year) {
    filters.push({ release_date: buildRegexFilter(year, { startsWith: true }) });
  }

  const filter: Record<string, unknown> = filters.length ? { $and: filters } : {};

  await connectMongo();

  const query = CdModel.find(filter)
    .sort(sort)
    .populate('cover')
    .populate({
      path: 'track.ref',
      model: 'CdTrack',
      populate: [
        { path: 'track', model: 'UploadFile' },
        { path: 'lyric', model: 'Lyric' }
      ]
    })
    .lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const [cds, total] = await Promise.all([
    query,
    shouldPaginate ? CdModel.countDocuments(filter) : Promise.resolve(undefined)
  ]);

  const lyricIds = new Set<string>();
  for (const cd of cds) {
    const ids = collectLyricIdsFromCd(cd);
    ids.forEach((id) => lyricIds.add(id));
  }

  const lyricMap = await buildLyricMap(lyricIds);

  const formatted = await Promise.all(cds.map((cd) => formatCdForResponse(cd, lyricMap)));

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

    return NextResponse.json(await formatCdForResponse(await serializeCd(cd._id.toString())), { status: 201 });
  } catch (error) {
    console.error('CD create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
