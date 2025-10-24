import { Types } from 'mongoose';

type AnyRecord = Record<string, unknown>;

export function isObjectIdLike(value: unknown): value is Types.ObjectId {
  return (
    value instanceof Types.ObjectId ||
    (typeof value === 'object' && value !== null && (value as { _bsontype?: string })._bsontype === 'ObjectID')
  );
}

function convert(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(convert);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isObjectIdLike(value)) {
    return value.toString();
  }
  if (value && typeof value === 'object') {
    const result: AnyRecord = {};
    for (const [key, nested] of Object.entries(value as AnyRecord)) {
      result[key] = convert(nested);
    }
    const idValue = typeof result._id === 'string' ? result._id : typeof result.id === 'string' ? result.id : undefined;
    if (idValue) {
      result._id = idValue;
      result.id = idValue;
    }
    return result;
  }
  return value;
}

export function normalizeDocument<T>(doc: T | null | undefined): T | null {
  if (doc == null) {
    return doc ?? null;
  }
  return convert(doc) as T;
}

function ensureHttpsUrl(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.startsWith('blob:') || value.startsWith('data:')) {
    return value;
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  if (value.startsWith('http://')) {
    return `https://${value.slice('http://'.length)}`;
  }

  return value;
}

export function normalizeUploadFile<T>(file: T | null | undefined): T | null {
  const normalized = normalizeDocument(file);
  if (!normalized || typeof normalized !== 'object') {
    return normalized ?? null;
  }

  const record = normalized as AnyRecord;

  if (typeof record.url === 'string') {
    record.url = ensureHttpsUrl(record.url) as typeof record.url;
  }

  if (typeof record.previewUrl === 'string') {
    record.previewUrl = ensureHttpsUrl(record.previewUrl) as typeof record.previewUrl;
  }

  if (record.formats && typeof record.formats === 'object') {
    const formats = record.formats as AnyRecord;
    for (const [key, value] of Object.entries(formats)) {
      if (!value || typeof value !== 'object') {
        delete formats[key];
        continue;
      }

      const normalizedFormat = normalizeDocument(value) as AnyRecord;
      if (normalizedFormat && typeof normalizedFormat.url === 'string') {
        normalizedFormat.url = ensureHttpsUrl(normalizedFormat.url) as typeof normalizedFormat.url;
      }
      formats[key] = normalizedFormat;
    }
  }

  return record as T;
}

export function normalizeUploadFileList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Record<string, unknown>[];
  }

  return value
    .map((entry) => normalizeUploadFile(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'));
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');
}

export function buildRegexFilter(value: string, { startsWith = false }: { startsWith?: boolean } = {}) {
  const escaped = escapeRegExp(value.trim());
  const pattern = startsWith ? `^${escaped}` : escaped;
  return { $regex: pattern, $options: 'i' } as const;
}

export function normalizeLyric(lyric: unknown) {
  const normalized = normalizeDocument(lyric);
  if (normalized && typeof normalized === 'object') {
    const record = normalized as AnyRecord & { composer?: unknown; composers?: unknown };
    if (!record.composer && record.composers) {
      record.composer = record.composers;
    }
  }
  return normalized;
}

export function extractTrackDocument(entry: AnyRecord | null | undefined) {
  if (!entry) return null;
  if (entry.ref && typeof entry.ref === 'object') {
    return entry.ref as AnyRecord;
  }
  return entry as AnyRecord;
}

export function normalizeTrackList(entries: unknown[], options: { lyricMap?: Map<string, AnyRecord> } = {}) {
  const { lyricMap } = options;
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const trackDoc = extractTrackDocument(entry as AnyRecord);
      if (!trackDoc) {
        return null;
      }
      const normalized = normalizeDocument(trackDoc) as AnyRecord | null;
      if (!normalized) {
        return null;
      }
      if (normalized.track && typeof normalized.track === 'object') {
        normalized.track = normalizeUploadFile(normalized.track) as unknown;
      }
      const lyricId = (() => {
        const rawLyric = trackDoc.lyric as unknown;
        if (!rawLyric) return undefined;
        if (typeof rawLyric === 'string') return rawLyric;
        if (isObjectIdLike(rawLyric)) return rawLyric.toString();
        if (typeof rawLyric === 'object' && rawLyric !== null) {
          const candidate = (rawLyric as AnyRecord)._id ?? (rawLyric as AnyRecord).id;
          if (typeof candidate === 'string') return candidate;
          if (isObjectIdLike(candidate)) return candidate.toString();
        }
        return undefined;
      })();

      if (lyricId && lyricMap) {
        const lyric = lyricMap.get(lyricId);
        if (lyric) {
          normalized.lyrics = normalizeLyric(lyric);
        }
      }

      return normalized;
    })
    .filter((value): value is AnyRecord => Boolean(value));
}

export function withPublishedFlag<T extends AnyRecord>(doc: T, publishedAtField: keyof T = 'published_at' as keyof T) {
  if (!doc) return doc;
  const publishedAt = doc[publishedAtField];
  return {
    ...doc,
    published: Boolean(publishedAt)
  };
}

export function parseLegacyPagination(searchParams: URLSearchParams) {
  const limitParam = searchParams.get('_limit') ?? searchParams.get('limit');
  const startParam = searchParams.get('_start') ?? searchParams.get('start');
  const pageParam = searchParams.get('page');
  const pageSizeParam = searchParams.get('pageSize') ?? searchParams.get('page_size');

  const parsedLimit = limitParam != null ? Number.parseInt(limitParam, 10) : Number.NaN;
  const parsedStart = startParam != null ? Number.parseInt(startParam, 10) : Number.NaN;
  const parsedPage = pageParam != null ? Number.parseInt(pageParam, 10) : Number.NaN;
  const parsedPageSize = pageSizeParam != null ? Number.parseInt(pageSizeParam, 10) : Number.NaN;

  let limit = Number.isNaN(parsedLimit) ? undefined : Math.max(parsedLimit, 0);
  let start = Number.isNaN(parsedStart) ? undefined : Math.max(parsedStart, 0);
  const page = Number.isNaN(parsedPage) ? undefined : Math.max(parsedPage, 1);
  let pageSize = Number.isNaN(parsedPageSize) ? undefined : Math.max(parsedPageSize, 0);

  if (page && pageSize) {
    limit = pageSize;
    start = (page - 1) * pageSize;
  } else if (page && limit) {
    pageSize = limit;
    start = (page - 1) * limit;
  } else if (pageSize && !limit) {
    limit = pageSize;
  }

  const shouldPaginate = typeof limit === 'number' && limit > 0;
  const resolvedPageSize = limit ?? pageSize;

  return {
    start,
    limit,
    page,
    pageSize: resolvedPageSize,
    shouldPaginate
  } as const;
}

export function resolveStatusFilter(
  searchParams: URLSearchParams,
  { publishedField = 'published_at', defaultStatus }: { publishedField?: string; defaultStatus?: 'all' | 'published' | 'draft' } = {}
) {
  const rawStatus = searchParams.get('status')?.trim().toLowerCase();
  const publishedParam = searchParams.get('published');
  const hasPaginationParams = ['page', 'pageSize', 'page_size'].some((param) => searchParams.has(param));

  let status: 'all' | 'published' | 'draft' | undefined;
  if (rawStatus === 'published' || rawStatus === 'draft' || rawStatus === 'all') {
    status = rawStatus;
  } else if (publishedParam === 'false') {
    status = 'draft';
  } else if (publishedParam === 'true') {
    status = 'published';
  }

  if (!status) {
    status =
      defaultStatus ??
      (hasPaginationParams
        ? 'all'
        : 'published');
  }

  if (status === 'all') {
    return null;
  }

  if (status === 'draft') {
    return { [publishedField]: null } as Record<string, unknown>;
  }

  return { [publishedField]: { $ne: null } } as Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function buildPaginatedResponse<T>(
  items: T[],
  { total, limit, start, page }: { total?: number; limit?: number; start?: number; page?: number }
): PaginatedResponse<T> {
  const effectiveLimit = limit && limit > 0 ? limit : items.length || 1;
  const totalCount = typeof total === 'number' ? total : items.length;
  const totalPages = effectiveLimit > 0 ? Math.max(1, Math.ceil(totalCount / effectiveLimit)) : 1;
  const computedPage = (() => {
    if (page && page > 0) return page;
    if (typeof start === 'number' && effectiveLimit > 0) {
      return Math.floor(start / effectiveLimit) + 1;
    }
    return 1;
  })();

  return {
    data: items,
    pagination: {
      page: computedPage,
      totalPages,
      total: totalCount,
      limit: effectiveLimit
    }
  };
}
