import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';

const TextSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    content: { type: String, required: true },
    excerpt: String,
    category: String,
    author: String,
    cover: { type: Types.ObjectId, ref: 'UploadFile' },
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyUniqueSlug(TextSchema);

TextSchema.index({ title: 'text', content: 'text', category: 'text', author: 'text' });

export type Text = InferSchemaType<typeof TextSchema>;

export default models.Text || model('Text', TextSchema);
