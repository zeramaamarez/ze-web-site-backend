import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { dvdSchema } from '@/lib/validations/dvd';
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

async function serializeDvd(id: string) {
  return DvdModel.findById(id)
    .populate('cover')
    .populate({
      path: 'track',
      model: 'DvdTrack',
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

const TRACK_DATA_KEYS = new Set(['name', 'label', 'composers', 'time', 'lyric', 'track']);

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

async function ensureDvdTracksHydrated(dvd: AnyRecord | null | undefined) {
  if (!dvd) {
    return dvd;
  }

  const entries = Array.isArray((dvd as { track?: unknown[] }).track)
    ? ((dvd as { track: unknown[] }).track as unknown[])
    : [];

  if (!entries.length) {
    return dvd;
  }

  const needsHydration = entries.some((entry) => entryNeedsHydration(entry));
  if (!needsHydration) {
    return dvd;
  }

  const ids = entries
    .map((entry) => extractTrackId(entry))
    .filter((value): value is string => Boolean(value));

  if (!ids.length) {
    return dvd;
  }

  const uniqueIds = Array.from(new Set(ids));
  const trackDocs = await DvdTrackModel.find({ _id: { $in: uniqueIds } })
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
    return dvd;
  }

  (dvd as { track: unknown[] }).track = entries.map((entry) => {
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

  return dvd;
}

async function formatDvd(
  dvd: Record<string, unknown> | null,
  lyricMap?: Map<string, Record<string, unknown>>
) {
  if (!dvd) return null;

  const hydrated = (await ensureDvdTracksHydrated(dvd)) as typeof dvd & { track?: unknown[]; cover?: unknown };
  let map = lyricMap;
  if (!map) {
    const ids = new Set<string>();
    for (const entry of (hydrated.track as unknown[]) ?? []) {
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

    if (ids.size) {
      const lyricDocs = await LyricModel.find({ _id: { $in: Array.from(ids) } }).lean();
      map = new Map(
        lyricDocs
          .map((doc) => {
            const normalized = normalizeDocument(doc);
            const id = normalized?.id as string | undefined;
            if (!normalized || !id) return null;
            return [id, normalized] as const;
          })
          .filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry))
      );
    } else {
      map = new Map();
    }
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
  const [sortField, sortDirection] = (searchParams.get('_sort') || searchParams.get('sort') || '').split(':');
  const sort = buildSort(sortField || undefined, sortDirection || searchParams.get('order'));
  const search = searchParams.get('search');
  const yearFilter = searchParams.get('year');
  const { start, limit, shouldPaginate, page } = parseLegacyPagination(searchParams);

  const filters: Record<string, unknown>[] = [];
  filters.push({ $or: [{ deleted: { $exists: false } }, { deleted: false }] });

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
        { release_date: regex }
      ]
    });
  }

  if (yearFilter) {
    filters.push({ release_date: buildRegexFilter(yearFilter, { startsWith: true }) });
  }

  const filter: Record<string, unknown> = filters.length ? { $and: filters } : {};

  await connectMongo();
  const query = DvdModel.find(filter)
    .sort(sort)
    .populate('cover')
    .populate({
      path: 'track',
      model: 'DvdTrack',
      populate: [{ path: 'track', model: 'UploadFile' }]
    })
    .lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const [dvds, total] = await Promise.all([
    query,
    shouldPaginate ? DvdModel.countDocuments(filter) : Promise.resolve(undefined)
  ]);

  await Promise.all(dvds.map((dvd) => ensureDvdTracksHydrated(dvd)));

  const lyricIds = new Set<string>();
  for (const dvd of dvds) {
    for (const entry of dvd.track ?? []) {
      const track = (entry as { ref?: { lyric?: unknown } }).ref ?? entry;
      const rawLyric = track?.lyric as unknown;
      if (!rawLyric) continue;
      if (typeof rawLyric === 'string') {
        if (/^[a-fA-F0-9]{24}$/.test(rawLyric)) {
          lyricIds.add(rawLyric);
        }
      } else if (isObjectIdLike(rawLyric)) {
        lyricIds.add(rawLyric.toString());
      } else if (typeof rawLyric === 'object' && rawLyric !== null) {
        const candidate = (rawLyric as { _id?: unknown; id?: unknown })._id ?? (rawLyric as { id?: unknown }).id;
        if (typeof candidate === 'string') {
          lyricIds.add(candidate);
        } else if (isObjectIdLike(candidate)) {
          lyricIds.add(candidate.toString());
        }
      }
    }
  }

  const lyricDocs = lyricIds.size
    ? await LyricModel.find({ _id: { $in: Array.from(lyricIds) } }).lean()
    : [];
  const lyricMap = new Map(
    lyricDocs
      .map((doc) => {
        const normalized = normalizeDocument(doc);
        const id = normalized?.id as string | undefined;
        if (!normalized || !id) return null;
        return [id, normalized] as const;
      })
      .filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry))
  );

  const formatted = await Promise.all(dvds.map((dvd) => formatDvd(dvd, lyricMap)));

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
    const parsed = dvdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    await connectMongo();

    const { tracks = [], status: _status, ...dvdData } = parsed.data;
    const publishedAtInput = dvdData.publishedAt ?? dvdData.published_at ?? null;
    const normalizedPublishedAt = publishedAtInput ? new Date(publishedAtInput) : null;

    const dvd = await DvdModel.create({
      ...dvdData,
      status: normalizedPublishedAt ? 'published' : 'draft',
      publishedAt: normalizedPublishedAt,
      published_at: normalizedPublishedAt,
      created_by: authResult.session.user!.id,
      updated_by: authResult.session.user!.id
    });

    if (tracks.length) {
      const trackIds: string[] = [];
      for (const track of tracks) {
        const trackDoc = await DvdTrackModel.create({
          name: track.name,
          composers: track.composers,
          label: track.label,
          time: track.time,
          lyric: track.lyric,
          track: track.track || undefined
        });
        if (track.track) {
          await attachFile({ fileId: track.track, refId: trackDoc._id, kind: 'DvdTrack', field: 'track' });
        }
        trackIds.push(trackDoc._id.toString());
      }
      dvd.track = trackIds;
      await dvd.save();
    }

    if (dvdData.cover) {
      await attachFile({ fileId: dvdData.cover, refId: dvd._id, kind: 'Dvd', field: 'cover' });
    }

    return NextResponse.json(await formatDvd(await serializeDvd(dvd._id.toString())), { status: 201 });
  } catch (error) {
    console.error('DVD create error', error);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
