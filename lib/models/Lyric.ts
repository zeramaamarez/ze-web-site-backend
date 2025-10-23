import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';

const LyricSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    lyric: String,
    composers: String,
    album: String,
    year: String,
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyUniqueSlug(LyricSchema);

LyricSchema.index({ title: 'text', composers: 'text', album: 'text' });

export type Lyric = InferSchemaType<typeof LyricSchema>;

export default models.Lyric || model('Lyric', LyricSchema);
