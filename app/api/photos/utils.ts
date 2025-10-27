import { Types } from 'mongoose';
import UploadFileModel from '@/lib/models/UploadFile';
import { normalizeUploadFile, withPublishedFlag } from '@/lib/legacy';

export type AnyRecord = Record<string, unknown>;

export function resolveObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    try {
      return new Types.ObjectId(value);
    } catch (error) {
      return null;
    }
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as { _id?: unknown; id?: unknown; ref?: unknown };
    if (record._id) return resolveObjectId(record._id);
    if (record.id) return resolveObjectId(record.id);
    if (record.ref) return resolveObjectId(record.ref);
  }
  return null;
}

export function resolveObjectIdString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown; ref?: unknown };
    return (
      resolveObjectIdString(record._id) ??
      resolveObjectIdString(record.id) ??
      resolveObjectIdString(record.ref)
    );
  }
  return null;
}

export function normalizeFileIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value
    .map((entry) => resolveObjectIdString(entry))
    .filter((entry): entry is string => Boolean(entry && Types.ObjectId.isValid(entry)));
}

export function collectPhotoUploadIds(doc: { url?: unknown; image?: unknown } | null | undefined) {
  const ids = new Set<string>();
  if (!doc) {
    return [] as string[];
  }

  const urlValue = doc.url as unknown;
  const urlEntries = Array.isArray(urlValue) ? urlValue : urlValue != null ? [urlValue] : [];
  for (const entry of urlEntries) {
    const id = resolveObjectIdString(entry);
    if (id) {
      ids.add(id);
    }
  }

  const legacyImageId = resolveObjectIdString(doc.image);
  if (legacyImageId) {
    ids.add(legacyImageId);
  }

  return Array.from(ids);
}

export async function buildUploadMap(ids: Iterable<string>) {
  const uniqueIds = Array.from(new Set(Array.from(ids))).filter((id) => Types.ObjectId.isValid(id));
  if (uniqueIds.length === 0) {
    return new Map<string, AnyRecord>();
  }

  const objectIds = uniqueIds
    .map((id) => {
      try {
        return new Types.ObjectId(id);
      } catch (error) {
        return null;
      }
    })
    .filter((value): value is Types.ObjectId => Boolean(value));

  if (objectIds.length === 0) {
    return new Map<string, AnyRecord>();
  }

  const uploads = await UploadFileModel.find({
    _id: { $in: objectIds },
    deleted: { $ne: true }
  }).lean();
  const map = new Map<string, AnyRecord>();

  for (const upload of uploads) {
    const plain = JSON.parse(JSON.stringify(upload)) as AnyRecord;
    const normalized = normalizeUploadFile(plain);
    if (!normalized || typeof normalized !== 'object') {
      continue;
    }
    const record = normalized as AnyRecord;
    const id =
      resolveObjectIdString(record.id) ??
      resolveObjectIdString(record._id) ??
      resolveObjectIdString(plain._id) ??
      resolveObjectIdString(upload._id);
    if (!id) {
      continue;
    }
    record.id = id;
    record._id = id;
    map.set(id, JSON.parse(JSON.stringify(record)) as AnyRecord);
  }

  return map;
}

function cloneUploadRecord(record: AnyRecord) {
  return JSON.parse(JSON.stringify(record)) as AnyRecord;
}

function createUploadRecord(entry: unknown, uploadMap?: Map<string, AnyRecord>) {
  const id = resolveObjectIdString(entry);

  if (id && uploadMap) {
    const match = uploadMap.get(id);
    if (match) {
      const cloned = cloneUploadRecord(match);
      if (cloned && typeof cloned === 'object') {
        cloned._id = id;
        cloned.id = id;
        return cloned;
      }
    }
  }

  const normalized = normalizeUploadFile(entry);
  if (normalized && typeof normalized === 'object') {
    const record = normalized as AnyRecord;
    const resolvedId =
      resolveObjectIdString((record as { id?: unknown }).id) ??
      resolveObjectIdString((record as { _id?: unknown })._id) ??
      id;
    if (resolvedId) {
      record.id = resolvedId;
      record._id = resolvedId;
    }
    return record;
  }

  if (id) {
    return { _id: id, id } as AnyRecord;
  }

  return null;
}

export function formatPhoto(
  doc: Record<string, unknown> | null,
  { uploadMap }: { uploadMap?: Map<string, AnyRecord> } = {}
) {
  if (!doc) return null;

  const source = doc as { url?: unknown; image?: unknown };
  const rawUrlValue = source.url as unknown;
  const rawUrlEntries = Array.isArray(rawUrlValue)
    ? rawUrlValue
    : rawUrlValue != null
    ? [rawUrlValue]
    : [];

  const record = JSON.parse(JSON.stringify(doc)) as AnyRecord & {
    url?: unknown;
    image?: unknown;
    id?: unknown;
    _id?: unknown;
  };

  const hydratedUrls = rawUrlEntries
    .map((entry) => createUploadRecord(entry, uploadMap))
    .filter((value): value is AnyRecord => Boolean(value));

  const legacyImage = createUploadRecord(source.image, uploadMap);
  if (!hydratedUrls.length && legacyImage) {
    hydratedUrls.push(legacyImage);
  }

  record.url = hydratedUrls;
  record.image = hydratedUrls[0] ?? legacyImage ?? null;

  const resolvedId = resolveObjectIdString(record._id) ?? resolveObjectIdString(record.id);
  if (resolvedId) {
    record._id = resolvedId;
    record.id = resolvedId;
  }

  return withPublishedFlag(record);
}
