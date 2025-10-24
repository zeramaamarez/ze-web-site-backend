import { NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import DvdModel from '@/lib/models/Dvd';
import DvdTrackModel from '@/lib/models/DvdTrack';
import { dvdSchema } from '@/lib/validations/dvd';
import { requireAdmin } from '@/lib/api';
import { attachFile } from '@/lib/upload';
import LyricModel from '@/lib/models/Lyric';
import { isObjectIdLike, normalizeDocument, normalizeTrackList, parseLegacyPagination, withPublishedFlag } from '@/lib/legacy';

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
    .populate({ path: 'track.ref', model: 'DvdTrack', populate: { path: 'lyric', model: 'Lyric' } })
    .lean();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const [sortField, sortDirection] = (searchParams.get('_sort') || searchParams.get('sort') || '').split(':');
  const sort = buildSort(sortField || undefined, sortDirection || searchParams.get('order'));
  const search = searchParams.get('search');
  const yearFilter = searchParams.get('year');
  const { start, limit } = parseLegacyPagination(searchParams);

  const filters: Record<string, unknown>[] = [{ published_at: { $ne: null } }];
  if (search) {
    filters.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { release_date: { $regex: search, $options: 'i' } }
      ]
    });
  }

  if (yearFilter) {
    filters.push({ release_date: { $regex: new RegExp(yearFilter, 'i') } });
  }

  const filter: Record<string, unknown> = filters.length ? { $and: filters } : {};

  await connectMongo();
  const query = DvdModel.find(filter)
    .sort(sort)
    .populate('cover')
    .populate({ path: 'track.ref', model: 'DvdTrack', populate: { path: 'lyric', model: 'Lyric' } })
    .lean();

  if (typeof start === 'number' && start > 0) {
    query.skip(start);
  }

  if (typeof limit === 'number' && limit >= 0 && limit > 0) {
    query.limit(limit);
  }

  const dvds = await query;

  const lyricIds = new Set<string>();
  for (const dvd of dvds) {
    for (const entry of dvd.track ?? []) {
      const track = (entry as { ref?: { lyric?: unknown } }).ref ?? entry;
      const rawLyric = track?.lyric as unknown;
      if (!rawLyric) continue;
      if (typeof rawLyric === 'string') {
        lyricIds.add(rawLyric);
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

  const formatted = dvds.map((dvd) => {
    const { track, cover, ...rest } = dvd as typeof dvd & { track?: unknown[]; cover?: unknown };
    const normalizedRest = (normalizeDocument(rest) ?? {}) as Record<string, unknown>;
    return {
      ...withPublishedFlag(normalizedRest),
      cover: normalizeDocument(cover),
      track: normalizeTrackList((track as unknown[]) ?? [], { lyricMap })
    };
  });

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
