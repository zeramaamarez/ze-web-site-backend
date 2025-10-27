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
      path: 'track',
      model: 'CdTrack',
      populate: [{ path: 'track', model: 'UploadFile' }]
    })
    .lean();
}

type AnyRecord = Record<string, unknown>;

function toIdString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (isObjectIdLike(value)) {
    return value.toString();
  }

  return null;
}

function extractTrackId(entry: unknown): string | null {
  if (!entry) {
    return null;
  }

  const direct = toIdString(entry);
  if (direct) {
    return direct;
  }

  if (typeof entry === 'object') {
    const record = entry as AnyRecord;
    const ref = (record as { ref?: unknown }).ref;
    if (ref != null) {
      const nested = extractTrackId(ref);
      if (nested) {
        return nested;
      }
    }

    const idCandidate =
      toIdString((record as { _id?: unknown })._id) ?? toIdString((record as { id?: unknown }).id);
    if (idCandidate) {
      return idCandidate;
    }
  }

  return null;
}

const TRACK_DATA_KEYS = new Set(['name', 'composers', 'time', 'lyric', 'track']);

function entryNeedsHydration(entry: unknown): boolean {
  if (!entry) {
    return false;
  }

  if (typeof entry === 'string') {
    return true;
  }

  if (isObjectIdLike(entry)) {
    return true;
  }

  if (typeof entry === 'object') {
    const record = entry as AnyRecord;
    const ref = (record as { ref?: unknown }).ref;
    if (ref != null) {
      return entryNeedsHydration(ref);
    }

    const hasDataFields = Array.from(TRACK_DATA_KEYS).some((key) => key in record);
    if (hasDataFields) {
      return false;
    }

    const idCandidate =
      toIdString((record as { _id?: unknown })._id) ?? toIdString((record as { id?: unknown }).id);
    return Boolean(idCandidate);
  }

  return false;
}

async function ensureCdTracksHydrated(cd: AnyRecord | null | undefined) {
  if (!cd) {
    return cd;
  }

  const entries = Array.isArray((cd as { track?: unknown[] }).track)
    ? ((cd as { track: unknown[] }).track as unknown[])
    : [];

  if (!entries.length) {
    return cd;
  }

  const needsHydration = entries.some((entry) => entryNeedsHydration(entry));
  if (!needsHydration) {
    return cd;
  }

  const ids = entries
    .map((entry) => extractTrackId(entry))
    .filter((value): value is string => Boolean(value));

  if (!ids.length) {
    return cd;
  }

  const uniqueIds = Array.from(new Set(ids));
  const trackDocs = await CdTrackModel.find({ _id: { $in: uniqueIds } })
    .populate({ path: 'track', model: 'UploadFile' })
    .lean();

  const trackMap = new Map<string, AnyRecord>();
  for (const doc of trackDocs) {
    const key = toIdString((doc as { _id?: unknown })._id) ?? toIdString((doc as { id?: unknown }).id);
    if (key) {
      trackMap.set(key, doc as AnyRecord);
    }
  }

  if (!trackMap.size) {
    return cd;
  }

  (cd as { track: unknown[] }).track = entries.map((entry) => {
    const id = extractTrackId(entry);
    if (!id) {
      return entry;
    }

    const doc = trackMap.get(id);
    if (!doc) {
      return entry;
    }

    if (entry && typeof entry === 'object') {
      const record = entry as AnyRecord;
      if ('ref' in record) {
        return { ...record, ref: doc };
      }
    }

    return doc;
  });

  return cd;
}

function collectLyricIdsFromCd(cd: { track?: unknown[] }) {
  const ids = new Set<string>();
  for (const entry of cd.track ?? []) {
    const track = (entry as { ref?: { lyric?: unknown } }).ref ?? entry;
    const rawLyric = track?.lyric as unknown;
    if (!rawLyric) continue;
    if (typeof rawLyric === 'string') {
      if (/^[a-fA-F0-9]{24}$/.test(rawLyric)) {
        ids.add(rawLyric);
      }
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

  const hydrated = (await ensureCdTracksHydrated(cd)) as typeof cd & { track?: unknown[]; cover?: unknown };
  let map = lyricMap;
  if (!map) {
    const ids = collectLyricIdsFromCd(hydrated as { track?: unknown[] });
    map = await buildLyricMap(ids);
  }

  const { track, cover, ...rest } = hydrated;
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
  let sort = buildSort(sortField || undefined, sortDirection || searchParams.get('order'));
  const search = searchParams.get('search');
  const company = searchParams.get('company');
  const year = searchParams.get('year');
  const { start, limit, shouldPaginate, page } = parseLegacyPagination(searchParams);

  const filters: Record<string, unknown>[] = [];
  filters.push({ deleted: { $ne: true } });
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

  if (!shouldPaginate && !sortParam) {
    sort = { release_date: -1, createdAt: -1 };
  }

  const filter: Record<string, unknown> = filters.length ? { $and: filters } : {};

  await connectMongo();

  const query = CdModel.find(filter)
    .sort(sort)
    .populate('cover')
    .populate({
      path: 'track',
      model: 'CdTrack',
      populate: [{ path: 'track', model: 'UploadFile' }]
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

  await Promise.all(cds.map((cd) => ensureCdTracksHydrated(cd)));

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

    const { tracks = [], status: _status, ...cdData } = parsed.data;
    const publishedAtInput = cdData.publishedAt ?? cdData.published_at ?? null;
    const normalizedPublishedAt = publishedAtInput ? new Date(publishedAtInput) : null;

    const cd = await CdModel.create({
      ...cdData,
      status: normalizedPublishedAt ? 'published' : 'draft',
      publishedAt: normalizedPublishedAt,
      published_at: normalizedPublishedAt,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    if (tracks.length) {
      const trackIds: string[] = [];
      for (const track of tracks) {
        const trackDoc = await CdTrackModel.create({
          name: track.name,
          composers: track.composers,
          time: track.time,
          track: track.track || undefined,
          lyric: track.lyric
        });
        if (track.track) {
          await attachFile({ fileId: track.track, refId: trackDoc._id, kind: 'CdTrack', field: 'track' });
        }
        trackIds.push(trackDoc._id.toString());
      }
      cd.track = trackIds;
      await cd.save();
    }

    if (cdData.cover) {
      await attachFile({ fileId: cdData.cover, refId: cd._id, kind: 'Cd', field: 'cover' });
    }

    return NextResponse.json(await formatCdForResponse(await serializeCd(cd._id.toString())), { status: 201 });
  } catch (error) {
    console.error('CD create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
