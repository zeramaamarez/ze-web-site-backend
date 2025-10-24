import type { Document, Schema } from 'mongoose';

type StatusDocument = Document & {
  status?: 'draft' | 'published';
  publishedAt?: Date | null;
  published_at?: Date | null;
};

type StatusOptions = {
  statusField?: string;
  publishedAtField?: string;
  legacyPublishedAtField?: string;
};

const STATUS_VALUES = ['draft', 'published'] as const;

function resolveField<T extends StatusDocument>(doc: T, key: keyof StatusDocument) {
  return doc[key as keyof StatusDocument] as unknown as Date | string | undefined | null;
}

export function applyStatusFields(schema: Schema, options: StatusOptions = {}) {
  const statusField = options.statusField ?? 'status';
  const publishedAtField = options.publishedAtField ?? 'publishedAt';
  const legacyPublishedAtField = options.legacyPublishedAtField ?? 'published_at';

  if (!schema.path(statusField)) {
    schema.add({
      [statusField]: {
        type: String,
        enum: STATUS_VALUES,
        required: true,
        default: 'draft'
      }
    });
  }

  if (!schema.path(publishedAtField)) {
    schema.add({
      [publishedAtField]: {
        type: Date,
        default: null
      }
    });
  }

  if (legacyPublishedAtField && !schema.path(legacyPublishedAtField)) {
    schema.add({
      [legacyPublishedAtField]: {
        type: Date,
        default: null
      }
    });
  }

  schema.pre('init', function (this: StatusDocument, doc) {
    if (!doc) return;
    const publishedAt = doc[publishedAtField] ?? doc[legacyPublishedAtField];
    if (publishedAt !== undefined) {
      doc[publishedAtField] = publishedAt;
      doc[legacyPublishedAtField] = publishedAt;
    }
    if (!doc[statusField]) {
      doc[statusField] = publishedAt ? 'published' : 'draft';
    }
  });

  schema.pre('validate', function (this: StatusDocument, next) {
    const currentStatus = (this.get(statusField) as StatusDocument['status']) ?? undefined;
    const publishedAt =
      (this.get(publishedAtField) as StatusDocument['publishedAt']) ??
      (legacyPublishedAtField ? (this.get(legacyPublishedAtField) as StatusDocument['published_at']) : null);

    if (!currentStatus) {
      this.set(statusField, publishedAt ? 'published' : 'draft');
    }

    if (this.get(statusField) === 'published' && !publishedAt) {
      const now = new Date();
      this.set(publishedAtField, now);
      if (legacyPublishedAtField) {
        this.set(legacyPublishedAtField, now);
      }
    }

    if (this.get(statusField) === 'draft' && publishedAt) {
      // keep publishedAt as history, but ensure legacy field stays in sync
      if (legacyPublishedAtField) {
        this.set(legacyPublishedAtField, publishedAt);
      }
    }

    next();
  });

  schema.pre('save', function (this: StatusDocument, next) {
    const publishedAt = resolveField(this as StatusDocument, publishedAtField as keyof StatusDocument);
    if (legacyPublishedAtField) {
      const legacyValue = resolveField(this as StatusDocument, legacyPublishedAtField as keyof StatusDocument);
      if (publishedAt && !legacyValue) {
        this.set(legacyPublishedAtField, publishedAt);
      }
      if (!publishedAt && legacyValue) {
        this.set(publishedAtField, legacyValue);
      }
    }
    next();
  });
}

export type StatusValue = (typeof STATUS_VALUES)[number];
