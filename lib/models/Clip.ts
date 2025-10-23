import { models, model, Schema, Types, type InferSchemaType } from 'mongoose';
import { applyUniqueSlug } from '@/lib/models/plugins/uniqueSlug';

const ClipSchema = new Schema(
  {
    title: { type: String, required: true },
    info: String,
    url: { type: String, required: true },
    slug: { type: String, unique: true, index: true },
    cover: [{ type: Types.ObjectId, ref: 'UploadFile' }],
    published_at: { type: Date, default: null },
    created_by: { type: Types.ObjectId, ref: 'Admin' },
    updated_by: { type: Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

applyUniqueSlug(ClipSchema);

ClipSchema.index({ title: 'text', info: 'text' });

export type Clip = InferSchemaType<typeof ClipSchema>;

export default models.Clip || model('Clip', ClipSchema);
