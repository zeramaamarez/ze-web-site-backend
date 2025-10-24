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

  const parsedLimit = limitParam != null ? Number.parseInt(limitParam, 10) : Number.NaN;
  const parsedStart = startParam != null ? Number.parseInt(startParam, 10) : Number.NaN;

  const limit = Number.isNaN(parsedLimit) ? undefined : parsedLimit;
  const start = Number.isNaN(parsedStart) ? undefined : Math.max(parsedStart, 0);

  return { start, limit } as const;
}
