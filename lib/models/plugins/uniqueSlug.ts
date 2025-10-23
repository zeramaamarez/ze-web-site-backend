import type { Schema } from 'mongoose';
import { generateSlug } from '@/lib/utils';

interface UniqueSlugOptions {
  source?: string;
  slugField?: string;
}

export function applyUniqueSlug(schema: Schema, options: UniqueSlugOptions = {}) {
  const { source = 'title', slugField = 'slug' } = options;

  schema.pre('validate', async function () {
    const doc = this as typeof this & {
      [key: string]: unknown;
      isModified(path: string): boolean;
      constructor: typeof import('mongoose').Model<any>;
      _id?: unknown;
    };

    const sourceValue = doc[source];
    if (typeof sourceValue !== 'string' || !sourceValue.trim()) {
      return;
    }

    const baseSlug = generateSlug(sourceValue);
    let currentSlug = typeof doc[slugField] === 'string' ? (doc[slugField] as string) : undefined;

    if (!currentSlug || doc.isModified(source) || doc.isModified(slugField)) {
      currentSlug = baseSlug;
    }

    const Model = doc.constructor;

    const buildFilter = (slug: string) => {
      const filter: Record<string, unknown> = { [slugField]: slug };
      if (doc._id) {
        filter._id = { $ne: doc._id };
      }
      return filter;
    };

    let slugToUse = currentSlug || baseSlug;
    let suffix = 1;

    while (await Model.exists(buildFilter(slugToUse))) {
      slugToUse = `${baseSlug}-${suffix++}`;
    }

    doc[slugField] = slugToUse;
  });
}
